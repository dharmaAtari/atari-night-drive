/**
 * AudioSystem — the whole soundtrack, synthesised.
 *
 * There are no audio files in this project and `config.audio.sounds` is empty on
 * purpose. Every sound here is a few oscillators and a noise buffer, which buys
 * three things worth more than recorded samples would be: nothing to download,
 * an engine note that tracks speed continuously rather than looping, and a taut
 * hum whose pitch is bound to live rope tension — so the snap is audible before
 * it happens, not after.
 *
 * Audio is an enhancement and never a dependency. Every entry point that touches
 * the AudioContext is wrapped: any failure tears the graph down and leaves the
 * system permanently, silently off. A browser that refuses to make noise must
 * still play the game.
 *
 * Browsers will not start an AudioContext without a gesture, so `unlock()` is
 * called on the first press. Until then this does nothing at all.
 */
import { GameEvent, RunState, type World } from '../world.js';
import { isRopeAttached } from './RopeSystem.js';
import { enginePitch, engineGain, tautPitch } from '../audio/synth.js';

/** How quickly continuous voices glide to a new target. Short enough to track. */
const GLIDE_SECONDS = 0.08;

export default class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGainNode: GainNode | null = null;
  private taut: OscillatorNode | null = null;
  private tautGainNode: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;

  constructor(private readonly volume: number) {}

  get ready(): boolean {
    return this.context !== null;
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.failed || this.context) return;

    this.guard(() => {
      const Ctor = globalThis.AudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }

      const context = new Ctor();
      const master = context.createGain();
      master.gain.value = this.volume;
      master.connect(context.destination);

      // The engine and the taut hum run continuously from here and are shaped by
      // gain, rather than being started and stopped — restarting an oscillator
      // per frame would click.
      const engine = context.createOscillator();
      engine.type = 'sawtooth';
      const engineGainNode = context.createGain();
      engineGainNode.gain.value = 0;
      engine.connect(engineGainNode).connect(master);
      engine.start();

      const taut = context.createOscillator();
      taut.type = 'triangle';
      const tautGainNode = context.createGain();
      tautGainNode.gain.value = 0;
      taut.connect(tautGainNode).connect(master);
      taut.start();

      this.context = context;
      this.master = master;
      this.engine = engine;
      this.engineGainNode = engineGainNode;
      this.taut = taut;
      this.tautGainNode = tautGainNode;
      this.noise = createNoiseBuffer(context);

      void context.resume();
    });
  }

  update(world: World): void {
    const context = this.context;
    if (!context || !this.engine || !this.engineGainNode || !this.taut || !this.tautGainNode) return;

    this.guard(() => {
      const now = context.currentTime;
      const running = world.run.state === RunState.RUNNING;

      // Engine pitch is the speedometer this game deliberately does not draw.
      const pitch = enginePitch(world.config, world.car.speed);
      const gain = running ? engineGain(world.car.speed, world.config.speed.start) : 0;
      this.engine!.frequency.setTargetAtTime(pitch, now, GLIDE_SECONDS);
      this.engineGainNode!.gain.setTargetAtTime(gain, now, GLIDE_SECONDS);

      // The hum rises with tension, so "about to snap" is something you hear.
      const attached = running && isRopeAttached(world.rope.state);
      this.taut!.frequency.setTargetAtTime(tautPitch(world.rope.tension), now, GLIDE_SECONDS);
      this.tautGainNode!.gain.setTargetAtTime(attached ? 0.05 + 0.1 * world.rope.tension : 0, now, GLIDE_SECONDS);

      for (const event of world.events) this.playCue(event.type);
    });
  }

  private playCue(type: string): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;

    const t = context.currentTime;
    switch (type) {
      case GameEvent.ROPE_THROWN:
        this.whoosh(t, 0.16, 0.05);
        break;
      case GameEvent.ROPE_ATTACHED:
        this.tone(t, 0.09, 0.16, 520, 780, 'square');
        break;
      case GameEvent.ROPE_MISSED:
        this.tone(t, 0.07, 0.09, 200, 120, 'square');
        break;
      case GameEvent.ROPE_SNAPPED:
        this.tone(t, 0.3, 0.2, 340, 60, 'sawtooth');
        this.whoosh(t, 0.3, 0.12);
        break;
      case GameEvent.PICKUP_POWER:
        this.tone(t, 0.2, 0.16, 620, 1240, 'triangle');
        break;
      case GameEvent.PICKUP_HIGH_BEAM:
        this.tone(t, 0.24, 0.16, 880, 1760, 'triangle');
        break;
      case GameEvent.CRASHED:
        // One hard impact, then silence before the restart. No death jingle.
        this.tone(t, 0.45, 0.3, 160, 40, 'sawtooth');
        this.whoosh(t, 0.45, 0.25);
        break;
      default:
        break;
    }
  }

  private tone(
    start: number,
    duration: number,
    peak: number,
    from: number,
    to: number,
    type: OscillatorType,
  ): void {
    const context = this.context!;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    // Exponential ramps cannot reach zero, hence the small floor.
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain).connect(this.master!);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private whoosh(start: number, duration: number, peak: number): void {
    const context = this.context!;
    if (!this.noise) return;

    const source = context.createBufferSource();
    source.buffer = this.noise;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, start);
    filter.frequency.exponentialRampToValueAtTime(300, start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(gain).connect(this.master!);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  dispose(): void {
    this.guard(() => {
      this.engine?.stop();
      this.taut?.stop();
      void this.context?.close();
    });
    this.context = null;
    this.master = null;
    this.engine = null;
    this.taut = null;
  }

  /** Any audio failure is permanent and silent. The game keeps running. */
  private guard(fn: () => void): void {
    if (this.failed) return;
    try {
      fn();
    } catch {
      this.failed = true;
      this.context = null;
      this.master = null;
      this.engine = null;
      this.taut = null;
    }
  }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
