import type { World } from '../world';
import type { RopeState, RunState } from '../types/states';
import { GAME_EVENTS } from '../types/game-events';
import { isRopeAttached } from './RopeSystem';
import { cuesForEvents, enginePitch, engineGain, tautPitch, lowPowerPulseGain } from '../audio/synth';
import type { CueName } from '../audio/synth';

export interface AudioSystem {
  unlock(): void;
  update(world: World, dt: number): void;
  dispose(): void;
  readonly ready: boolean;
}

// Web Audio is never allowed to break the game (GDD 15 is an enhancement, not a dependency).
// Every entry point that touches the AudioContext is wrapped in this, and any failure just
// tears the graph down and leaves the system permanently silent.
function guard(onFailure: () => void, fn: () => void): void {
  try {
    fn();
  } catch {
    onFailure();
  }
}

// setTargetAtTime time constant for the continuous voices (engine, taut hum): short enough to
// track a per-frame change, long enough that the per-frame steps glide instead of zipper.
const GLIDE_SECONDS = 0.08;
const DUCK_SECONDS = 0.05;

const CUE_DURATIONS: Record<CueName, number> = {
  ropeThrow: 0.18,
  ropeAttach: 0.08,
  ropeSnap: 0.35,
  ropeMiss: 0.06,
  pickupPower: 0.22,
  pickupHighBeam: 0.22,
  crash: 0.5,
};

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof AudioContext !== 'undefined') {
    return AudioContext;
  }
  const withWebkit = globalThis as unknown as { webkitAudioContext?: AudioContextCtor };
  if (typeof withWebkit.webkitAudioContext !== 'undefined') {
    return withWebkit.webkitAudioContext;
  }
  return undefined;
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const duration = 1;
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  duration: number,
  peak: number,
  frequencyFrom: number,
  frequencyTo: number,
  type: OscillatorType,
): void {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequencyFrom, startTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyTo), startTime + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playChimeNote(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  duration: number,
  peak: number,
  hz: number,
): void {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = hz;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playNoiseBurst(
  context: AudioContext,
  destination: AudioNode,
  noiseBuffer: AudioBuffer,
  startTime: number,
  duration: number,
  peak: number,
  filterType: BiquadFilterType,
  frequencyFrom: number,
  frequencyTo: number,
): void {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequencyFrom, startTime);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyTo), startTime + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.05);
}

export function createAudioSystem(): AudioSystem {
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let noiseBuffer: AudioBuffer | undefined;

  let engineOsc: OscillatorNode | undefined;
  let engineFilter: BiquadFilterNode | undefined;
  let engineGainNode: GainNode | undefined;

  let tautOsc: OscillatorNode | undefined;
  let tautGainNode: GainNode | undefined;

  let lowPowerOsc: OscillatorNode | undefined;
  let lowPowerGainNode: GainNode | undefined;

  let disposed = false;
  let engineDucked = false;
  let prevRopeState: RopeState | undefined;
  let prevRunState: RunState | undefined;

  function teardown(): void {
    ctx = undefined;
    master = undefined;
    noiseBuffer = undefined;
    engineOsc = undefined;
    engineFilter = undefined;
    engineGainNode = undefined;
    tautOsc = undefined;
    tautGainNode = undefined;
    lowPowerOsc = undefined;
    lowPowerGainNode = undefined;
  }

  function unlock(): void {
    if (ctx || disposed) {
      return;
    }
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) {
      return;
    }
    guard(teardown, () => {
      const context = new Ctor();

      const masterGain = context.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(context.destination);

      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = context.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start();

      const taut = context.createOscillator();
      taut.type = 'sine';
      const tGain = context.createGain();
      tGain.gain.value = 0;
      taut.connect(tGain);
      tGain.connect(masterGain);
      taut.start();

      const pulse = context.createOscillator();
      pulse.type = 'sine';
      pulse.frequency.value = 200;
      const pGain = context.createGain();
      pGain.gain.value = 0;
      pulse.connect(pGain);
      pGain.connect(masterGain);
      pulse.start();

      ctx = context;
      master = masterGain;
      noiseBuffer = createNoiseBuffer(context);
      engineOsc = osc;
      engineFilter = filter;
      engineGainNode = gain;
      tautOsc = taut;
      tautGainNode = tGain;
      lowPowerOsc = pulse;
      lowPowerGainNode = pGain;
    });
  }

  function playCue(cue: CueName, startTime: number): void {
    if (!ctx || !master || !noiseBuffer) {
      return;
    }
    const context = ctx;
    const destination = master;
    const buffer = noiseBuffer;
    const duration = CUE_DURATIONS[cue];
    switch (cue) {
      case 'ropeThrow':
        playNoiseBurst(context, destination, buffer, startTime, duration, 0.3, 'bandpass', 2200, 400);
        break;
      case 'ropeAttach':
        playTone(context, destination, startTime, duration, 0.5, 180, 80, 'triangle');
        break;
      case 'ropeSnap':
        playNoiseBurst(context, destination, buffer, startTime, duration, 0.6, 'highpass', 1500, 1500);
        break;
      case 'ropeMiss':
        playNoiseBurst(context, destination, buffer, startTime, duration, 0.2, 'lowpass', 500, 500);
        break;
      case 'pickupPower':
        playChimeNote(context, destination, startTime, duration, 0.3, 660);
        playChimeNote(context, destination, startTime + 0.05, duration, 0.25, 990);
        break;
      case 'pickupHighBeam':
        playChimeNote(context, destination, startTime, duration, 0.3, 880);
        playChimeNote(context, destination, startTime + 0.05, duration, 0.25, 1320);
        break;
      case 'crash':
        playNoiseBurst(context, destination, buffer, startTime, duration, 0.8, 'lowpass', 4000, 150);
        break;
    }
  }

  function duckEngine(now: number): void {
    engineDucked = true;
    engineGainNode?.gain.setTargetAtTime(0, now, DUCK_SECONDS);
    tautGainNode?.gain.setTargetAtTime(0, now, DUCK_SECONDS);
    lowPowerGainNode?.gain.setTargetAtTime(0, now, DUCK_SECONDS);
  }

  function update(world: World, _dt: number): void {
    if (!ctx || !master || !engineOsc || !engineGainNode || !tautOsc || !tautGainNode || !lowPowerGainNode) {
      return;
    }
    guard(teardown, () => {
      const context = ctx as AudioContext;
      const now = context.currentTime;

      // A fresh run un-ducks the engine; resetRun() puts runState back to 'running' directly.
      if (world.runState === 'running' && prevRunState !== 'running') {
        engineDucked = false;
      }
      prevRunState = world.runState;

      const targetEngineGain = engineDucked ? 0 : engineGain(world.car.speed, world.config.speed.start);
      engineOsc!.frequency.setTargetAtTime(enginePitch(world.config, world.car.speed), now, GLIDE_SECONDS);
      engineGainNode!.gain.setTargetAtTime(targetEngineGain, now, GLIDE_SECONDS);
      // Brighten the tone with speed so the rise reads in timbre as well as pitch.
      engineFilter!.frequency.setTargetAtTime(600 + world.car.speed * 3, now, GLIDE_SECONDS);

      const tautTarget = !engineDucked && isRopeAttached(world.rope) ? 0.15 : 0;
      tautOsc!.frequency.setTargetAtTime(tautPitch(world.rope.tension), now, GLIDE_SECONDS);
      tautGainNode!.gain.setTargetAtTime(tautTarget, now, GLIDE_SECONDS);

      const pulseTarget = engineDucked ? 0 : lowPowerPulseGain(world.light.power, world.elapsed);
      lowPowerGainNode!.gain.setTargetAtTime(pulseTarget, now, 0.03);

      // ropeThrow has no dedicated GameEvent; detect it from the state transition instead.
      if (prevRopeState !== 'throwing' && world.rope.state === 'throwing') {
        playCue('ropeThrow', now);
      }
      prevRopeState = world.rope.state;

      const cues = cuesForEvents(world.events);
      cues.forEach((cue, i) => {
        if (cue !== 'ropeAttach') {
          playCue(cue, now);
          if (cue === 'crash') {
            duckEngine(now);
          }
          return;
        }
        // Pickups piggyback on RopeAttached (PickupSystem reads anchor.kind the same way);
        // cuesForEvents is order-preserving and 1:1 with world.events, so the index lines up.
        const event = world.events[i];
        const anchorId = event.type === GAME_EVENTS.RopeAttached ? event.anchorId : undefined;
        const anchor = anchorId !== undefined ? world.anchors.find((a) => a.id === anchorId) : undefined;
        if (anchor?.kind === 'power') {
          playCue('pickupPower', now);
        } else if (anchor?.kind === 'highBeam') {
          playCue('pickupHighBeam', now);
        } else {
          playCue('ropeAttach', now);
        }
      });
    });
  }

  function dispose(): void {
    disposed = true;
    if (!ctx) {
      return;
    }
    const context = ctx;
    guard(teardown, () => {
      engineOsc?.stop();
      tautOsc?.stop();
      lowPowerOsc?.stop();
      void context.close();
    });
    teardown();
  }

  return {
    unlock,
    update,
    dispose,
    get ready(): boolean {
      return ctx !== undefined;
    },
  };
}
