import { describe, it, expect } from 'vitest';
import { makeConfig } from '../testing/makeWorld';
import { createRng } from '../rng';
import { createHazardGenerator, emissionSpacing } from './HazardGenerator';
import { isWindowViable } from './AnchorSystem';
import { coneLength, glowRadius } from './LightSystem';
import type { Hazard } from '../components/Hazard';
import { hazardLanes } from '../components/Hazard';

const SEED_COUNT = 10_000;
// 10,000 seeds x 200 emissions kept this file's runtime well under the ~20s budget on a dev
// machine (see report for the measured runtime), so it was not necessary to fall back to 100.
const EMISSIONS_PER_RUN = 200;

describe('emissionSpacing', () => {
  it('scales from maxIntervalSeconds down to minIntervalSeconds as difficulty rises', () => {
    const config = makeConfig();
    const speed = 40;
    const atZero = emissionSpacing(config, speed, 0);
    const atOne = emissionSpacing(config, speed, 1);
    expect(atZero).toBeGreaterThan(atOne);
  });

  it('holds constant once difficulty reaches densityCapDifficulty', () => {
    const config = makeConfig();
    const speed = 40;
    const atCap = emissionSpacing(config, speed, config.hazards.densityCapDifficulty);
    const beyondCap = emissionSpacing(config, speed, config.hazards.densityCapDifficulty + 0.5);
    expect(atCap).toBeCloseTo(beyondCap, 9);
  });

  it('never drops below the rule 4.3.5 base floor (speed * cycle time)', () => {
    const config = makeConfig();
    for (const speed of [config.speed.start, 60, 90]) {
      const spacing = emissionSpacing(config, speed, 1);
      const floor = speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration);
      expect(spacing).toBeGreaterThanOrEqual(floor - 1e-9);
    }
  });
});

describe('HazardGenerator fairness invariants (property test)', () => {
  const config = makeConfig();
  const speeds = [config.speed.start, 60, 90];
  const difficulties = [0, 0.5, 1];

  it(
    `satisfies rules 4.3.1-4.3.5 on every emission across ${SEED_COUNT} seeds x ${EMISSIONS_PER_RUN} emissions`,
    () => {
      // Perf note: this loop runs SEED_COUNT * EMISSIONS_PER_RUN times (2,000,000 for the
      // defaults above). `expect(cond, msg)` is only invoked on the failing branch — the
      // template-literal context string is built lazily via `ctx()` so a passing run pays no
      // string-formatting cost. This keeps the file within the ~20s budget; the reported
      // runtime is measured with this shape, not the naive "always call expect" shape.
      for (let seed = 1; seed <= SEED_COUNT; seed++) {
        const comboIndex = seed % 9;
        const speed = speeds[comboIndex % 3];
        const difficulty = difficulties[Math.floor(comboIndex / 3)];

        const rng = createRng(seed);
        const generator = createHazardGenerator(rng);

        let fromS = 0;
        let nextId = 1;
        let prevHazard: Hazard | null = null;
        let prevSwing: -1 | 1 | null = null;
        const seenAnchorIds = new Set<number>();

        for (let i = 0; i < EMISSIONS_PER_RUN; i++) {
          const result = generator.next(config, fromS, speed, difficulty, nextId);
          const { hazard, anchors } = result.emission;
          const ctx = (): string =>
            `seed=${seed} speed=${speed} difficulty=${difficulty} emissionIndex=${i} hazard.kind=${hazard.kind}`;

          const hazardLaneList = hazardLanes(hazard);

          // Rule 4.3.1 — survivable.
          if (hazard.kind === 'obstacle') {
            const ok = hazard.lanes.length >= 1 && hazard.lanes.length <= 2;
            if (!ok) {
              expect(ok, `${ctx()}: obstacle occupies ${hazard.lanes.length} lanes (must be 1 or 2, never all 3)`).toBe(true);
            }
          }
          const hasFreeAnchor = anchors.some((a) => !hazardLaneList.includes(a.lane));
          if (!hasFreeAnchor) {
            expect(hasFreeAnchor, `${ctx()}: no anchor exists on a lane free of the hazard`).toBe(true);
          }

          // Rule 4.3.2 — safe side (plus curve inner-lane placement).
          for (const anchor of anchors) {
            const onHazardLane = hazardLaneList.includes(anchor.lane);
            if (onHazardLane) {
              expect(
                onHazardLane,
                `${ctx()}: anchor id=${anchor.id} lane=${anchor.lane} sits inside the obstacle's own lanes ${JSON.stringify(hazardLaneList)}`,
              ).toBe(false);
            }
          }
          if (hazard.kind === 'curve') {
            const innerLane = hazard.curve.endsWith('L') ? -1 : 1;
            const safeAnchor = anchors.find((a) => a.kind === 'safe');
            if (safeAnchor?.lane !== innerLane) {
              expect(
                safeAnchor?.lane,
                `${ctx()}: curve ${hazard.curve} safe anchor lane=${safeAnchor?.lane} is not the inner lane ${innerLane}`,
              ).toBe(innerLane);
            }
          }

          // Rule 4.3.3 — anchor first, in EVERY reachable lighting state.
          const lightStates = [
            { power: 0, highBeam: 0, highBeamActive: false },
            { power: 1, highBeam: 0, highBeamActive: false },
            { power: 0, highBeam: 1, highBeamActive: true },
            { power: 1, highBeam: 1, highBeamActive: true },
          ];
          for (const anchor of anchors) {
            for (const st of lightStates) {
              const visibleFrom = anchor.s - glowRadius(config, st, speed);
              const actionableFrom =
                hazard.s - coneLength(config, st) - config.hazards.leadMargin;
              const ok = visibleFrom <= actionableFrom + 1e-6;
              if (!ok) {
                expect(
                  ok,
                  `${ctx()}: anchor id=${anchor.id} visible from s=${visibleFrom} but hazard actionable at s=${actionableFrom} (power=${st.power}, highBeam=${st.highBeamActive})`,
                ).toBe(true);
              }
            }
          }

          // Rule 4.3.4 — reaction floor.
          for (const anchor of anchors) {
            const window = { windowOpenS: anchor.windowOpenS, windowCloseS: anchor.windowCloseS };
            const viable = isWindowViable(window);
            if (!viable) {
              expect(
                viable,
                `${ctx()}: anchor id=${anchor.id} kind=${anchor.kind} has a non-viable window [${window.windowOpenS}, ${window.windowCloseS}]`,
              ).toBe(true);
            }
            const windowSeconds = (window.windowCloseS - window.windowOpenS) / speed;
            const meetsFloor = windowSeconds >= config.rope.floorSeconds - 1e-9;
            if (!meetsFloor) {
              expect(
                meetsFloor,
                `${ctx()}: anchor id=${anchor.id} kind=${anchor.kind} window is ${windowSeconds}s, below the floor of ${config.rope.floorSeconds}s`,
              ).toBe(true);
            }
          }

          // Rule 4.3.5 — one cycle between consecutive hazards, including the opposite-swing penalty.
          const currSwing = anchors.find((a) => a.kind === 'safe')?.lane ?? null;
          if (prevHazard !== null) {
            const strictlyIncreasing = hazard.s > prevHazard.s;
            if (!strictlyIncreasing) {
              expect(
                strictlyIncreasing,
                `${ctx()}: hazard.s=${hazard.s} did not strictly increase past prevHazard.s=${prevHazard.s}`,
              ).toBe(true);
            }

            let minSpacing =
              speed * (config.rope.pullDuration + config.rope.holdMin + config.rope.returnDuration) + prevHazard.length;
            if (prevSwing !== null && currSwing !== null && prevSwing !== currSwing) {
              minSpacing += speed * config.rope.returnDuration;
            }
            const actualSpacing = hazard.s - prevHazard.s;
            const meetsCycleSpacing = actualSpacing >= minSpacing - 1e-6;
            if (!meetsCycleSpacing) {
              expect(
                meetsCycleSpacing,
                `${ctx()}: spacing=${actualSpacing} is below the rule 4.3.5 minimum=${minSpacing} (prevSwing=${prevSwing}, currSwing=${currSwing}, prevHazard.length=${prevHazard.length})`,
              ).toBe(true);
            }
          }

          // Additional invariants: unique anchor ids, valid anchor lanes.
          for (const anchor of anchors) {
            const reused = seenAnchorIds.has(anchor.id);
            if (reused) {
              expect(reused, `${ctx()}: anchor id=${anchor.id} was reused within this run`).toBe(false);
            }
            seenAnchorIds.add(anchor.id);
            const laneValid = anchor.lane === -1 || anchor.lane === 1;
            if (!laneValid) {
              expect(laneValid, `${ctx()}: anchor id=${anchor.id} lane=${anchor.lane} is not in {-1, 1}`).toBe(true);
            }
          }

          prevHazard = hazard;
          prevSwing = currSwing;
          fromS = hazard.s;
          nextId = result.nextId;
        }
      }
    },
    20_000,
  );
});
