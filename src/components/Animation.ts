/**
 * Animation — a spritesheet and how to play it back.
 *
 * Pure data, like every component: the sheet to draw from, how many frames it
 * holds, how fast to step them and whether it restarts at the end. Nothing here
 * advances the animation — `AnimationSystem` reads these fields, walks
 * `currentFrame` and hands the frame to the renderer.
 *
 * `sheet` is a path under `public/assets/sprites/animations/`, served as a
 * static file, so it is the same string in dev and in a build.
 *
 * Frames are numbered 0..frameCount-1 and played in order. A one-frame sheet is
 * a legal still image.
 *
 * `animationEnded` is sticky, not an edge flag: once a non-looping animation
 * reaches its last frame it stays true until someone restarts the animation.
 * Edge flags like `UserInput.justDown` are safe because one system clears them
 * every frame; an animation can finish on any frame, so a consumer that only
 * polls every other frame — or runs before this one in the frame order — would
 * miss the single frame it was true. A looping animation never ends, so the
 * flag stays false for as long as `loop` is set.
 */

/** Key this component is stored under on an entity. */
export const ANIMATION = 'animation';

export interface AnimationComponent {
  readonly type: typeof ANIMATION;
  /** path to the spritesheet, e.g. 'assets/sprites/animations/car-drive.png' */
  sheet: string;
  /** how many frames the sheet holds */
  frameCount: number;
  /** playback speed in frames per second */
  frameRate: number;
  /** restart from frame 0 at the end instead of stopping on the last frame */
  loop: boolean;

  // --- playback state, written by AnimationSystem ---

  /** frame being shown, 0..frameCount-1 */
  currentFrame: number;
  /** seconds accumulated toward the next frame */
  elapsed: number;
  /** false leaves the animation parked on currentFrame */
  playing: boolean;
  /**
   * A non-looping animation has reached its last frame. Stays true until the
   * animation is restarted; always false while `loop` is set.
   */
  animationEnded: boolean;
}

export type AnimationInit = Partial<Omit<AnimationComponent, 'type'>>;

export function Animation({
  sheet = '',
  frameCount = 1,
  frameRate = 12,
  loop = true,
  currentFrame = 0,
  elapsed = 0,
  playing = true,
  animationEnded = false,
}: AnimationInit = {}): AnimationComponent {
  return {
    type: ANIMATION,
    sheet,
    frameCount,
    frameRate,
    loop,
    currentFrame,
    elapsed,
    playing,
    animationEnded,
  };
}

export default Animation;
