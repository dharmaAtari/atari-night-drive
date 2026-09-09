/**
 * CountdownSystem — the beat before a run: 3, 2, 1, go.
 *
 * The world is built and lit but nothing moves and no press does anything, so
 * the player's first sight of the road is what they are about to drive into,
 * not a hazard already on top of them. The engine turns over underneath it.
 *
 * It raises one event per digit and `RUN_STARTED` on go, which is what the HUD
 * and the audio read; neither needs to know how long the count is. Length is a
 * tunable (`config.start.countdownSeconds`), and zero skips straight to running.
 */
import { GameEvent, RunState, type World } from '../world.js';

/** The digit shown for the time left: 2.4 s reads as "3", 0.2 s as "1". */
export function countdownDigit(secondsLeft: number): number {
  return Math.max(1, Math.ceil(secondsLeft));
}

export function countdownSystem(world: World, dt: number): void {
  const { run } = world;
  if (run.state !== RunState.COUNTDOWN) return;

  const before = countdownDigit(run.countdown);
  run.countdown = Math.max(0, run.countdown - dt);

  if (run.countdown <= 0) {
    run.state = RunState.RUNNING;
    world.events.push({ type: GameEvent.RUN_STARTED });
    return;
  }

  const after = countdownDigit(run.countdown);
  if (after < before) world.events.push({ type: GameEvent.COUNTDOWN_TICK, count: after });
}
