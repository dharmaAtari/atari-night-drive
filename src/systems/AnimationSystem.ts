/**
 * AnimationSystem — steps every `Animation` forward at its own frame rate.
 *
 * The only thing that writes `currentFrame`, `elapsed`, `playing` and
 * `animationEnded`. Entities carrying an `Animation` are advanced independently,
 * so a 24fps explosion and a 6fps idle loop can run side by side regardless of
 * how fast the game itself is rendering.
 *
 * Frames advance on accumulated time rather than on frame count, so playback
 * speed is the same on a 30Hz and a 144Hz display. The step is computed
 * arithmetically instead of in a `while` loop: a backgrounded tab hands back a
 * delta of several seconds on the first frame after it wakes, and a loop would
 * grind through every intervening frame for nothing.
 *
 * At the end of a run:
 *   loop = true    wraps to frame 0 and keeps going, animationEnded stays false
 *   loop = false   parks on the last frame, playing = false, animationEnded = true
 *
 * `animationEnded` is sticky — see the note in the component. Call `restart()`
 * to play it again.
 */
import type Entity from '../entities/Entity.js';
import { ANIMATION, type AnimationComponent } from '../components/index.js';

/**
 * Slack, in frames, on the step count.
 *
 * Frame intervals are not representable in binary: at 10fps the interval is
 * 0.1, and three of them accumulate to 0.29999999999999993, which divides to
 * 2.9999999999999996 and floors to 2. Without this the animation lands a frame
 * late every time the elapsed time hits an exact multiple. Small enough that it
 * can never manufacture a step that has not nearly arrived.
 */
const STEP_EPSILON = 1e-9;

export default class AnimationSystem {
  /**
   * Advances every animated entity.
   *
   * `delta` is milliseconds, matching what Phaser hands `Scene.update`.
   */
  update(entities: Entity[], delta: number): void {
    const seconds = delta / 1000;

    for (const entity of entities) {
      if (!entity.active) continue;

      const animation = entity.get(ANIMATION);
      if (!animation) continue;

      this.step(animation, seconds);
    }
  }

  /**
   * Advances one animation by `seconds`. Exposed so a scene can drive an
   * animation that is not on an entity yet.
   */
  step(animation: AnimationComponent, seconds: number): void {
    if (!animation.playing || animation.animationEnded) return;
    // A zero or negative rate would divide to Infinity; an empty sheet has no
    // frame to move to. Both are inert rather than an error — a component can
    // legitimately be built before its sheet is known.
    if (animation.frameRate <= 0 || animation.frameCount <= 0) return;

    const interval = 1 / animation.frameRate;
    animation.elapsed += seconds;

    const steps = Math.floor(animation.elapsed / interval + STEP_EPSILON);
    if (steps <= 0) return;

    // Keep the remainder so fractional frames are not lost across updates. The
    // epsilon can carry it a hair below zero; clamp so it cannot drift.
    animation.elapsed = Math.max(0, animation.elapsed - steps * interval);

    const target = animation.currentFrame + steps;
    const last = animation.frameCount - 1;

    if (target <= last) {
      animation.currentFrame = target;
      return;
    }

    if (animation.loop) {
      animation.currentFrame = target % animation.frameCount;
      return;
    }

    animation.currentFrame = last;
    animation.elapsed = 0;
    animation.playing = false;
    animation.animationEnded = true;
  }

  /** Rewinds to frame 0 and plays again, clearing `animationEnded`. */
  restart(animation: AnimationComponent): void {
    animation.currentFrame = 0;
    animation.elapsed = 0;
    animation.playing = true;
    animation.animationEnded = false;
  }

  /** Parks the animation on its current frame. `animationEnded` is untouched. */
  pause(animation: AnimationComponent): void {
    animation.playing = false;
  }

  /** Resumes a paused animation. A finished one needs `restart()` instead. */
  resume(animation: AnimationComponent): void {
    if (!animation.animationEnded) animation.playing = true;
  }
}
