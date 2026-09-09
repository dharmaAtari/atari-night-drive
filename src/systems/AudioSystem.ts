/**
 * AudioSystem — the soundtrack: recorded cues on Phaser's sound manager, plus
 * one synthesised voice for the thing no sample can follow.
 *
 * Every sample is asked for by logical key (`SoundKey`), and the only place a
 * key meets a file is `config.audio.sounds` — `BootScene` loads what that map
 * names, so re-voicing the game is a config edit. A key missing from the cache
 * costs that one cue and nothing else.
 *
 * Three voices run continuously while a run is live and are shaped by state,
 * never restarted per frame:
 *
 *   engine   a loop whose playback rate tracks speed — the speedometer this
 *            game deliberately does not draw
 *   wind     a loop whose volume climbs with speed, faster than the engine's
 *   drift    the tyre squeal, heard only while a curve is pushing an unroped
 *            car sideways — its volume is the drift rate, so slight bends
 *            whisper and sharp ones shout
 *
 * The rope's taut hum stays synthesised: its pitch is bound to live tension so
 * the snap is audible before it happens, and no looped sample can glide like
 * that. It only exists on the WebAudio backend; on HTML5 audio it is simply
 * absent.
 *
 * Everything else is a one-shot fired off the world's event queue, which is the
 * whole reason the queue exists: `RopeSystem` says the rope was thrown and this
 * system decides what that sounds like, without either knowing about the other.
 *
 * Audio is an enhancement and never a dependency. Every entry point is wrapped:
 * any failure tears the voices down and leaves the system permanently, silently
 * off. A browser that refuses to make noise must still play the game.
 */
import Phaser from 'phaser';
import { CrashCause, GameEvent, RunState, RopeState, curvatureAt, type RunEvent, type World } from '../world.js';
import { isRopeAttached } from './RopeSystem.js';
import { driftGain, engineGain, engineRate, tautPitch, windGain } from '../audio/synth.js';

/** Logical sound keys. The file behind each lives in `config.audio.sounds`. */
export const SoundKey = {
  UI_BLIP: 'ui.blip',
  ENGINE_START: 'engine.start',
  ENGINE_LOOP: 'engine.loop',
  WIND_LOOP: 'wind.loop',
  ROPE_THROW: 'rope.throw',
  ROPE_RELEASE: 'rope.release',
  CAR_DRIFT: 'car.drift',
  CRASH_OBSTACLE: 'crash.obstacle',
  CRASH_CAR: 'crash.car',
  PICKUP_CHIME: 'pickup.chime',
} as const;

export type SoundKeyValue = (typeof SoundKey)[keyof typeof SoundKey];

/** Per-second rate at which continuous voices glide to a new target. */
const GLIDE_PER_SECOND = 10;

/** How quickly the taut hum follows tension, in seconds. Short enough to track. */
const TAUT_GLIDE_SECONDS = 0.08;

/** Below this the drift squeal is stopped rather than left playing at nothing. */
const DRIFT_SILENCE = 0.02;

/** The count ticks on the UI blip; GO is the same blip a fifth up. */
const GO_BLIP_RATE = 1.5;

/** The engine loop idles under the start sample through the count. */
const ENGINE_IDLE_GAIN = 0.18;

/** The high-beam chime is the power chime a fourth up, so the two read apart. */
const HIGH_BEAM_CHIME_RATE = 1.25;

/** Gap between the obstacle thud and the wreck that follows it, in seconds. */
const WRECK_DELAY_SECONDS = 0.12;

/**
 * Every backend's sound can be shaped, but the base type does not say so; this
 * is the part of the concrete classes a continuous voice needs.
 */
type ShapedSound = Phaser.Sound.BaseSound & {
  setVolume(value: number): unknown;
  setRate(value: number): unknown;
};

/** A continuous voice: the Phaser sound plus the volume it is gliding toward. */
interface Voice {
  sound: ShapedSound;
  volume: number;
}

export default class AudioSystem {
  private manager: Phaser.Sound.BaseSoundManager | null;
  /** Only on the WebAudio backend; the taut hum needs it and nothing else does. */
  private context: AudioContext | null = null;
  private engine: Voice | null = null;
  private wind: Voice | null = null;
  private drift: Voice | null = null;
  /** The turn-over sample, kept so the engine cut on impact silences it too. */
  private starter: Phaser.Sound.BaseSound | null = null;
  private taut: OscillatorNode | null = null;
  private tautGainNode: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;

  constructor(manager: Phaser.Sound.BaseSoundManager, volume: number) {
    this.manager = manager;

    this.guard(() => {
      manager.volume = volume;

      if (!(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;
      const context = manager.context;

      // The hum runs from here and is shaped by gain rather than started and
      // stopped — restarting an oscillator per throw would click.
      const taut = context.createOscillator();
      taut.type = 'triangle';
      const tautGainNode = context.createGain();
      tautGainNode.gain.value = 0;
      taut.connect(tautGainNode).connect(manager.destination);
      taut.start();

      this.context = context;
      this.taut = taut;
      this.tautGainNode = tautGainNode;
      this.noise = createNoiseBuffer(context);
    });
  }

  get ready(): boolean {
    return this.manager !== null && !this.failed;
  }

  /**
   * Call from a real user gesture. Phaser unlocks its own context on the first
   * pointer or key event it sees on the page body, but a press delivered any
   * other way — a synthetic event, a gamepad — still counts as intent here.
   * Safe to call repeatedly.
   */
  unlock(): void {
    const context = this.context;
    if (!context || context.state !== 'suspended') return;
    this.guard(() => void context.resume());
  }

  /** A UI tick for menus, where there is no world to read events from. */
  blip(): void {
    this.play(SoundKey.UI_BLIP);
  }

  update(world: World, dt: number): void {
    if (!this.manager) return;

    this.guard(() => {
      const running = world.run.state === RunState.RUNNING;
      const counting = world.run.state === RunState.COUNTDOWN;
      const { config, car, rope, track } = world;

      for (const event of world.events) this.playCue(event);

      // Speed is heard, not shown: engine pitch and wind level both follow it.
      this.engine ??= this.loop(SoundKey.ENGINE_LOOP);
      this.wind ??= this.loop(SoundKey.WIND_LOOP);
      const engineTarget = running ? engineGain(config, car.speed) : counting ? ENGINE_IDLE_GAIN : 0;
      this.drive(this.engine, engineTarget, dt, engineRate(config, car.speed));
      this.drive(this.wind, running ? windGain(config, car.speed) : 0, dt);

      // The squeal is only ever heard on an unroped curve — exactly when the
      // player needs telling — because the rope takes the car out of drift.
      const drifting = running && !isRopeAttached(rope.state) && rope.state !== RopeState.SNAPPED;
      const driftRate = drifting ? curvatureAt(track, car.s) * car.speed * config.drift.gain : 0;
      this.drift ??= this.loop(SoundKey.CAR_DRIFT);
      this.drive(this.drift, driftGain(driftRate), dt, undefined, DRIFT_SILENCE);

      // The hum rises with tension, so "about to snap" is something you hear.
      const context = this.context;
      if (context && this.taut && this.tautGainNode) {
        const now = context.currentTime;
        const attached = running && isRopeAttached(rope.state);
        this.taut.frequency.setTargetAtTime(tautPitch(rope.tension), now, TAUT_GLIDE_SECONDS);
        this.tautGainNode.gain.setTargetAtTime(
          attached ? 0.05 + 0.1 * rope.tension : 0,
          now,
          TAUT_GLIDE_SECONDS,
        );
      }
    });
  }

  private playCue(event: RunEvent): void {
    switch (event.type) {
      case GameEvent.COUNTDOWN_STARTED:
        // The engine turns over under the count; the loop idles in beneath it.
        this.startEngine();
        this.play(SoundKey.UI_BLIP);
        break;
      case GameEvent.COUNTDOWN_TICK:
        this.play(SoundKey.UI_BLIP);
        break;
      case GameEvent.RUN_STARTED:
        // Go. With the count configured away this is also where the engine
        // starts, so the sample plays here if nothing has yet.
        if (this.starter?.isPlaying !== true) this.startEngine();
        this.play(SoundKey.UI_BLIP, { rate: GO_BLIP_RATE });
        break;
      case GameEvent.ROPE_THROWN:
        this.play(SoundKey.ROPE_THROW);
        break;
      case GameEvent.ROPE_ATTACHED:
        // The bite. Short and bright, under the throw sample's tail.
        this.tone(0.09, 0.1, 520, 780, 'square');
        break;
      case GameEvent.ROPE_RELEASED:
        this.play(SoundKey.ROPE_RELEASE);
        break;
      case GameEvent.ROPE_MISSED:
        // No sample for a miss; a dull thud says "nothing there".
        this.tone(0.07, 0.09, 200, 120, 'square');
        break;
      case GameEvent.ROPE_SNAPPED:
        // The crack itself. The wreck it causes arrives with the crash event.
        this.tone(0.3, 0.2, 340, 60, 'sawtooth');
        this.whoosh(0.3, 0.12);
        break;
      case GameEvent.PICKUP_POWER:
        this.play(SoundKey.PICKUP_CHIME);
        break;
      case GameEvent.PICKUP_HIGH_BEAM:
        this.play(SoundKey.PICKUP_CHIME, { rate: HIGH_BEAM_CHIME_RATE });
        break;
      case GameEvent.CRASHED:
        // Engine cut, then the impact. No death jingle.
        this.silenceVoices();
        if (event.cause === CrashCause.OBSTACLE) {
          this.play(SoundKey.CRASH_OBSTACLE);
          this.play(SoundKey.CRASH_CAR, { delay: WRECK_DELAY_SECONDS });
        } else {
          this.play(SoundKey.CRASH_CAR);
        }
        break;
      default:
        break;
    }
  }

  /** Fires a one-shot by key. Silently nothing if the file never loaded. */
  private play(key: SoundKeyValue, config?: Phaser.Types.Sound.SoundConfig): void {
    const manager = this.manager;
    if (!manager || !this.has(key)) return;
    this.guard(() => void manager.play(key, config));
  }

  /** The turn-over sample, kept as one instance so the crash cut can stop it. */
  private startEngine(): void {
    this.starter ??= this.oneShot(SoundKey.ENGINE_START);
    this.starter?.play({ volume: 0.8 });
  }

  /** A reusable one-shot, for cues that must be stoppable. Null if not loaded. */
  private oneShot(key: SoundKeyValue): Phaser.Sound.BaseSound | null {
    const manager = this.manager;
    if (!manager || !this.has(key)) return null;
    return manager.add(key);
  }

  /** Builds a silent, looping voice, or null when the sample is not in the cache. */
  private loop(key: SoundKeyValue): Voice | null {
    const manager = this.manager;
    if (!manager || !this.has(key)) return null;
    return { sound: manager.add(key, { loop: true, volume: 0 }) as ShapedSound, volume: 0 };
  }

  /**
   * Glides a voice toward `target`, starting it when there is something to
   * hear and stopping it once it has faded below `floor`, so silent loops do
   * not run forever and a stopped loop does not pop back in at full volume.
   */
  private drive(voice: Voice | null, target: number, dt: number, rate?: number, floor = 0.001): void {
    if (!voice) return;

    const blend = Math.min(1, dt * GLIDE_PER_SECOND);
    voice.volume += (target - voice.volume) * blend;

    if (voice.volume < floor && target <= 0) {
      voice.volume = 0;
      if (voice.sound.isPlaying) voice.sound.stop();
      return;
    }

    if (!voice.sound.isPlaying) voice.sound.play();
    voice.sound.setVolume(voice.volume);
    if (rate !== undefined) voice.sound.setRate(rate);
  }

  /** The engine cut on impact: every engine voice stops this frame. */
  private silenceVoices(): void {
    for (const voice of [this.engine, this.wind, this.drift]) {
      if (!voice) continue;
      voice.volume = 0;
      if (voice.sound.isPlaying) voice.sound.stop();
    }
    if (this.starter?.isPlaying) this.starter.stop();
  }

  private has(key: SoundKeyValue): boolean {
    return this.manager?.game.cache.audio.exists(key) ?? false;
  }

  private tone(duration: number, peak: number, from: number, to: number, type: OscillatorType): void {
    const context = this.context;
    const manager = this.manager;
    if (!context || !(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;

    const start = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    // Exponential ramps cannot reach zero, hence the small floor.
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain).connect(manager.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private whoosh(duration: number, peak: number): void {
    const context = this.context;
    const manager = this.manager;
    if (!context || !this.noise || !(manager instanceof Phaser.Sound.WebAudioSoundManager)) return;

    const start = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.noise;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, start);
    filter.frequency.exponentialRampToValueAtTime(300, start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(gain).connect(manager.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  /**
   * Releases this scene's voices. The sound manager and its context belong to
   * the game and outlive the scene, so they are left alone.
   */
  dispose(): void {
    this.guard(() => {
      for (const voice of [this.engine, this.wind, this.drift]) {
        if (!voice) continue;
        voice.sound.stop();
        this.manager?.remove(voice.sound);
      }
      if (this.starter) {
        this.starter.stop();
        this.manager?.remove(this.starter);
      }
      this.taut?.stop();
      this.taut?.disconnect();
      this.tautGainNode?.disconnect();
    });
    this.teardown();
  }

  /** Any audio failure is permanent and silent. The game keeps running. */
  private guard(fn: () => void): void {
    if (this.failed) return;
    try {
      fn();
    } catch {
      this.failed = true;
      this.teardown();
    }
  }

  private teardown(): void {
    this.manager = null;
    this.context = null;
    this.engine = null;
    this.wind = null;
    this.drift = null;
    this.starter = null;
    this.taut = null;
    this.tautGainNode = null;
    this.noise = null;
  }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
