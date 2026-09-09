# Night Line — Implementation Plan (refined)

Companion to [GDD.md](./GDD.md). Phases are ordered by risk, not visibility: the verb is
built before the art, and the fairness invariants are tested before the content grows.

Every system except `*Render*` and `*Input*` is pure TypeScript with no Phaser import, so the
game logic runs under Vitest without a browser. Phaser touches the world only at the edges.

---

## Resolved design decisions (Gate 0 — closed 2026-09-09)

| # | Question | Decision | Consequence |
|---|---|---|---|
| G0.1 | How is a curve failable with discrete lanes? | **Curvature applies continuous outward drift ∝ `curvature × speed`. Lanes are attractors; car `x` is continuous. An attached rope cancels drift.** | §5 rewords to "the car *rests* in a lane"; off-road = `|x| > roadHalfWidth`. |
| G0.2 | Does headlight power tighten the throw window? | **Yes. Anchor glow radius scales with power, floored at the reaction-window distance for the current speed.** | Rule 4.3.4 holds by construction; §8.4 stays true. |
| G0.3 | Difficulty after the speed cap? | **Hazard density and combination rate ramp on the same curve as speed, cap together, then hold.** | Late game is sustained execution; runs bounded by attention, not a wall. |
| G0.4 | Multiple simultaneous anchors? | **Up to 2 on screen. Selection = nearest ahead of the car. Pickups are the second anchor on the same safe side.** | §8.3's choice is *temporal*: throw early for the pickup, late for the safe post. |

---

## Coordinate model (shared by every phase)

- **Longitudinal `s`** — metres along the track. The car sits at `carS`; the world advances by
  `speed × dt`. Everything ahead has `s > carS`.
- **Lateral `x`** — lane units. Lane width = 1. Lane centres at `x ∈ {-1, 0, +1}`. Road edges at
  `±roadHalfWidth` (1.5). Car `x` is continuous. Off-road when `|x| > roadHalfWidth`.
- **Curvature `κ`** — per track segment, signed. `κ > 0` turns right and drifts the car to
  `-x` (outward). Drift: `dx/dt = -κ × speed × driftGain` while the rope is not attached.
- **Distances, not durations.** Throw windows, glow radii and spawn lead are all in metres
  ahead of the car and derived from speed each frame. The reaction floor is then a single
  inequality: `windowMetres / speed ≥ floorSeconds`.

---

## Cross-cutting: platform, compatibility, resize, adaptive input

These apply from Phase 1 onward. They are not a phase; a phase that violates them does not
pass its exit gate.

### Target matrix

| Surface | Target | Note |
|---|---|---|
| Desktop browsers | Chrome, Edge, Firefox, Safari — two most recent major versions | Vite build target `baseline-widely-available`; no legacy transpile, no IE |
| iOS | Safari and WKWebView, two most recent iOS majors | Audio requires a user gesture; `100vh` is unreliable — use `visualViewport` |
| Android | Chrome and Android WebView, two most recent majors | Low-end reference: Qualcomm 215-class, 2 GB RAM, must hold ≥ 30 fps |
| Embed | iframe on a third-party page (MSN/Arkadium path) | No top-level navigation, no orientation lock, no `localStorage` assumption |
| Renderer | WebGL, **Canvas fallback via `Phaser.AUTO`** | Verified in Phaser 4.2.1 types: "If not, it will fall back to the Canvas Renderer" |

Anything outside this matrix is best-effort, not a bug.

### Resize and layout (owned by `ViewportSystem`, Phase 1)

- Scale mode `RESIZE`; the canvas is always the full viewport. Orientation is never locked;
  an orientation change is just a resize.
- Resize applies on the next frame — camera, HUD and hit regions all read `Viewport`, never
  cached numbers. Module-level size constants are forbidden (already a CLAUDE.md rule).
- **Device pixel ratio** honoured, capped at 2 for performance; drawn sizes are in CSS pixels,
  the canvas backing store in device pixels.
- **Safe-area insets** (`env(safe-area-inset-*)`) read from CSS custom properties into
  `Viewport.safe{Top,Right,Bottom,Left}`; HUD and prompts never enter the insets.
- Two **layout modes** derived from aspect ratio, not from user agent: `landscape` (≥ 1.0)
  and `portrait` (< 1.0). They change horizon ratio, car scale, cone length in screen space
  and the §13 HUD positions. Everything else is identical.
- `visualViewport` used for the height source on iOS so browser chrome collapsing does not
  leave a dead strip.
- Page-level: `touch-action: none`, `overscroll-behavior: none`, `user-select: none`, context
  menu suppressed on the canvas, `visibilitychange` pauses the run.

### Adaptive input (owned by `OneButtonInputSystem`, Phase 2)

The design is one button, so "adaptive" means *any surface is the button, and the game tells
you which one you are using* — not different control schemes.

- **Pointer Events** unify mouse, touch and pen. `pointerdown` anywhere on the canvas is the
  press; the first active pointer owns the hold; extra fingers are ignored, not treated as a
  second press. Hit region is the whole viewport minus nothing — safe-area insets do not
  reduce it.
- **Keyboard:** Space and Enter; auto-repeat suppressed via edge detection, so a held key is
  one hold.
- **Gamepad:** any button, polled; the same edge detection.
- **Detected input method** (`touch` | `mouse` | `keyboard` | `gamepad`) is recorded on the
  last press and drives prompt copy and iconography: "TAP AND HOLD" vs "HOLD SPACE" vs the
  face-button glyph. No settings screen; the game adapts on first input.
- Browser gestures that steal the press are neutralised: double-tap zoom, pull-to-refresh,
  long-press context menu, Safari's swipe-back edge (hold zones start 24 px in from the left
  edge on iOS only).
- **Focus and blur:** losing focus releases the hold (a detach, not a snap) and pauses; a
  press resumes. Losing the window mid-hold must never kill the player.

### Verification matrix (`scripts/verify.mjs`, extended per phase)

Playwright projects, all run on every phase's exit gate:

| Project | Viewport | Engine | Purpose |
|---|---|---|---|
| `desktop-chromium` | 1280×720 | Chromium | Baseline |
| `desktop-webkit` | 1280×720 | WebKit | Safari parity |
| `desktop-firefox` | 1280×720 | Firefox | Gecko parity |
| `phone-portrait` | iPhone 13 descriptor | WebKit | iOS, portrait, DPR 3, safe-area |
| `phone-landscape` | Pixel 7 descriptor rotated | Chromium | Android, landscape |
| `throttled` | 390×844 | Chromium, CPU ×4 | Low-end floor: ≥ 30 fps |
| `embed` | 1280×720 | Chromium | Game inside `test/embed.html` iframe |

Each project asserts: boots, ≥ target fps, no console errors, screenshot, and — from Phase 2
— a scripted press/hold/release via the input surface native to that project (touch tap on
phones, Space on desktop).

---

## Per-frame system order (final form)

```
OneButtonInput → Progression → Track → HazardGenerator → Anchor → Rope
→ Drift → Light → Pickup → Collision → Score → Camera → RoadRender → HUD
```

Input writes `InputState`; nothing downstream reads Phaser input. Render reads the world;
nothing upstream reads the renderer.

---

## Phase 0 — Clear the deck

**Objective:** remove the first-person MVP so nothing misleading survives into Phase 1.

Tasks
1. Delete `systems/ProjectionSystem.ts`, `systems/RoadSystem.ts`, `systems/MovementSystem.ts`,
   `systems/CollisionSystem.ts`, `components/Reflector.ts`, `components/PlayerState.ts`,
   `entities/reflector.ts`, `entities/player.ts`.
2. Strip the hood from `RenderSystem` (it will be rewritten in Phase 1 anyway).
3. Re-key `public/config.json` to the tuning surface at the end of this document; update
   `src/config.ts` to match.
4. Rewrite `CLAUDE.md` architecture section for the third-person, one-button game.
5. Mark `docs/mvp-spec.md` superseded in its first line.
6. Add Vitest: `npm i -D vitest`, `"test": "vitest run"`, `vitest.config.ts` including `src/**/*.test.ts`.

Exit gate: `npm run typecheck`, `npm run build`, `npm test` all green with zero tests; the
repo has no reference to reflectors-as-road.

---

## Phase 1 — Track, camera, car

**Objective:** a car drives forward on a curving three-lane road at 60 fps on both viewports,
drawn entirely with primitives. No rope, no hazards, no light model.

### Data model

```ts
// components/Track.ts
interface TrackSegment { s: number; length: number; curvature: number; }
interface Track { segments: TrackSegment[]; }            // ring buffer, sorted by s

// components/Car.ts
interface Car { s: number; x: number; speed: number; lean: -1 | 0 | 1; }

// components/Scenery.ts
interface ReflectorPost { s: number; x: number; }         // unlit posts, recycled pool
```

### Systems

- `TrackSystem` — advances `car.s`; extends the ring buffer ahead to `car.s + horizonMetres`
  with straight segments (Phase 3 replaces the straight-only generator with hazard-driven
  curves); recycles segments behind `car.s - tailMetres`.
- `DriftSystem` — `car.x -= κ(car.s) × speed × driftGain × dt` (G0.1). No rope yet, so the
  car drifts off on every curve — that is correct and is how Phase 1 proves the drift model.
  For Phase 1 verification only, a `debug.autoCentre` flag re-centres the car.
- `CameraSystem` — pseudo-3D projection. Walks segments from `car.s` forward, accumulating
  curvature into a screen-x offset so the road bends around the car; writes a `Projected[]`
  list of trapezoids (near y, far y, near half-width, far half-width, near/far centre x).
- `RoadRenderSystem` — Phaser `Graphics`: road quads as two `fillTriangle` calls each, lane
  dashes on lane boundaries alternating per segment, shoulder strips, unlit posts at
  `x = ±(roadHalfWidth + 0.2)` every `postSpacing` metres, car as a rectangle pinned to
  bottom-centre with `x` offset applied at the near plane.
- `ViewportSystem` — kept and extended per the cross-cutting section: DPR cap, safe-area
  insets, `visualViewport` height, and the `landscape`/`portrait` layout mode that sets
  horizon ratio, car scale and HUD anchors.

### Config keys introduced

`lanes.count = 3`, `lanes.width = 1`, `road.halfWidth = 1.5`, `road.horizonMetres = 300`,
`road.tailMetres = 10`, `road.segmentLength = 5`, `road.postSpacing = 12`,
`drift.gain = 1.0`, `camera.height`, `camera.depth`, `speed.start = 30` (m/s, placeholder)

### Tasks
1. Track ring buffer + `TrackSystem` (pure) + unit test: after N frames, segments cover
   `[car.s - tail, car.s + horizon]` with no gaps or overlaps.
2. `CameraSystem` (pure) + unit test: a straight track projects to a symmetric trapezoid; a
   constant-curvature track projects the far centre off-axis in the correct direction.
3. `RoadRenderSystem`, car rectangle, posts.
4. `DriftSystem` + unit test: on `κ = 0.01`, `speed = 30`, `driftGain = 1`, `x` moves
   `-0.3/s`; on straight track `x` is constant.
5. Debug track preset: straight → slight left → straight → 90° right, looped, for screenshots.
6. Extend `scripts/verify.mjs` into the seven-project verification matrix (cross-cutting
   section). Each project: 3 s fps sample, screenshots at a straight and at the 90° segment,
   assert the car rectangle's centre is within the road quad at the near plane, assert HUD
   elements sit outside safe-area insets on the phone projects.
7. Install the extra Playwright engines: `npx playwright install webkit firefox`.

### Exit gate
- ≥ 55 fps on every non-throttled project; ≥ 30 fps on `throttled`.
- Screenshots in `docs/verification/phase1-<project>.png` show a legible three-lane road that
  bends, in both layout modes, with HUD clear of the safe area.
- Rotating the phone projects mid-run re-lays out within one frame with no error.
- Unit tests for track coverage, projection direction and drift rate pass.

---

## Phase 2 — The rope (the verb)

**Objective:** one button, three timing skills, each independently reproducible. This phase
ends with a human playtest, not a green suite.

### Data model

```ts
// components/Anchor.ts
type AnchorKind = 'safe' | 'power' | 'highBeam';
interface Anchor {
  s: number; lane: -1 | 1; kind: AnchorKind;
  windowOpenS: number;   // car.s at which the window opens  (= s - ropeRange)
  windowCloseS: number;  // car.s at which it closes         (= hazardS - closeMargin)
  state: 'dormant' | 'open' | 'attached' | 'passed';
}

// components/Rope.ts
type RopeState = 'idle' | 'throwing' | 'attached' | 'returning' | 'cooldown' | 'snapped';
interface Rope {
  state: RopeState; anchorId: number | null;
  timer: number;           // seconds remaining in throwing / returning / cooldown
  extent: number;          // current rope length in metres (world units)
}

// components/InputState.ts
type InputMethod = 'touch' | 'mouse' | 'keyboard' | 'gamepad' | null;
interface InputState { held: boolean; pressedThisFrame: boolean; method: InputMethod; }
```

### State machine

```
idle ──press, open anchor ahead──► throwing ──throwDuration──► attached
idle ──press, none open─────────► cooldown ──missCooldown───► idle
attached ──release──────────────► returning ──returnDuration► idle
attached ──extent > maxExtent───► snapped   (terminal: collision)
```

- **Selection (G0.4):** among anchors with `state === 'open'`, pick the smallest `s - car.s ≥ 0`.
- **Range (rule 4.3.4):** `ropeRange = max(rope.baseRange, speed × rope.floorSeconds + rope.closeMargin)`.
  `Anchor.windowOpenS` is computed from this at spawn, so the floor is baked into the data.
- **Pull:** while `attached`, `car.x → laneX(anchor.lane)` over `pullDuration` (ease-out), then
  holds. Drift is zero while attached.
- **Extent:** `hypot((anchor.s - car.s) × metresPerLane⁻¹, anchor.x - car.x)` in lane-metre
  units. Grows past zero once `car.s > anchor.s`. `> rope.maxExtent` → `snapped`.
- **Return:** `car.x → 0` over `returnDuration`. A press during `returning` is honoured if an
  anchor is open (re-throw), otherwise ignored — no cooldown for a mid-return press.
- **Lean:** `car.lean = sign(anchor.lane)` while attached or pulling, `0` otherwise.

### Anticipatory cue for Skill 3 (risk #4 from the previous plan)

`Rope.tension = extent / maxExtent`. Render reads it: rope colour shifts toward the warning
colour above 0.7; the taut audio pitch rises with it (Phase 6). Snap must never be the first
signal.

### Config keys introduced

`rope.baseRange = 60`, `rope.floorSeconds = 0.45`, `rope.closeMargin = 8`,
`rope.maxExtent = 3.2`, `rope.throwDuration = 0.08`, `rope.pullDuration = 0.30`,
`rope.returnDuration = 0.45`, `rope.missCooldown = 0.50`

### Tasks
1. `OneButtonInputSystem` per the cross-cutting adaptive-input section: Pointer Events
   (first pointer owns the hold), Space/Enter with repeat suppressed, any gamepad button,
   edge-detected `pressedThisFrame`, `inputMethod` recorded on each press, focus/blur
   releases the hold as a detach and pauses.
2. `AnchorSystem` (pure) — state transitions by `car.s` against `windowOpenS/CloseS`.
3. `RopeSystem` (pure) — the state machine above.
4. Phase-2 test track: a hand-placed sequence of anchors with a stand-in "hazard line"
   (a stripe, no collision yet) so each skill can be exercised.
5. Unit tests, one per transition, plus four scripted scenarios driving the pure systems with
   a synthetic input trace:
   - clean swing: press in window, hold through hazard, release → back to idle at `x = 0`
   - Skill 1 early: press before `windowOpenS` → cooldown; second press inside window
     after cooldown succeeds only if window still open
   - Skill 2 early release: release with hazard alongside → `x` crosses hazard lane
   - Skill 3 overhold: hold until `extent > maxExtent` → `snapped`
6. Render: rope as a line from car to anchor, anchor pulse while `open`, car lean, and the
   prompt copy/glyph chosen from `InputState.method`.
7. Human playtest with the debug track. Record what did not read.

### Exit gate
- All four scenario tests pass deterministically.
- You have played it and the swing reads. If it does not, Phase 3 does not start.

---

## Phase 3 — Hazard generator and fairness invariants

**Objective:** a seeded generator that emits hazards with their anchors, and a property test
that proves rules 4.3.1–4.3.5 hold on every emission.

### Data model

```ts
// components/Hazard.ts
type ObstacleKind = 'stalled' | 'barrier' | 'pothole' | 'pedestrian' | 'debris';
type CurveKind = 'slightL' | 'slightR' | 'sharpL' | 'sharpR';
interface Obstacle { s: number; length: number; lanes: Set<-1 | 0 | 1>; kind: ObstacleKind; }
interface CurveHazard { s: number; length: number; kind: CurveKind; curvature: number; }
type Hazard = Obstacle | CurveHazard;

// generator output
interface Emission { hazard: Hazard; anchors: Anchor[]; }
```

### Generator contract

Given `(rng, car.s, speed, difficulty ∈ [0,1])`, emit the next `Emission` at
`s = car.s + spawnLead(speed)` such that:

1. **4.3.1 survivable** — the hazard leaves ≥ 1 lane free; for a curve, the inner lane is the
   safe lane; an anchor exists on a free lane.
2. **4.3.2 safe side** — every anchor's `lane ∉ hazard.lanes`.
3. **4.3.3 anchor first** — `anchor.s + glowRadius(speed, power) ≥ hazard.s + leadMargin`,
   i.e. the anchor is inside the glow before the hazard is inside the cone. (Uses the
   Phase-4 glow floor; until Phase 4, `glowRadius = ropeRange`.)
4. **4.3.4 floor** — `(anchor.windowCloseS - anchor.windowOpenS) / speed ≥ rope.floorSeconds`.
5. **4.3.5 one cycle** — `nextHazard.s - thisHazard.s ≥ speed × (pullDuration + holdMin +
   returnDuration) + hazard.length`, and if the required swings are opposite, add
   `speed × returnDuration` again.

Curves are emitted as hazards **and** written into the `Track` ring buffer as curvature over
`[s, s + length]`, replacing Phase 1's straight-only extension. Obstacle-in-curve combinations
are allowed only when `difficulty ≥ hazards.comboThreshold` and rule 5 still holds against the
curve's own swing.

### Config keys introduced

`hazards.spawnLeadSeconds = 4.0`, `hazards.minIntervalSeconds = 1.6`,
`hazards.maxIntervalSeconds = 3.2`, `hazards.comboThreshold = 0.6`,
`hazards.weights = { stalled: 4, barrier: 2, pothole: 2, pedestrian: 1, debris: 3 }`,
`curves.slight = 0.004`, `curves.sharp = 0.012`, `curves.slightLength = 60`,
`curves.sharpLength = 120`, `rope.holdMin = 0.25`

### Tasks
1. `src/rng.ts` — seeded PRNG (mulberry32 or xoshiro); the seed is shown on the game-over
   screen so any unfair run can be replayed.
2. `HazardGenerator` (pure) implementing the contract.
3. `TrackSystem` consumes curve emissions for curvature.
4. `CollisionSystem` (pure): obstacle overlap by `s`-range and lane footprint against
   `round(car.x)` while not in transit, continuous `car.x` while in transit; off-road by
   `|car.x| > roadHalfWidth`; snap from `RopeSystem`.
5. **Property test** — 10,000 seeds × speeds `{start, mid, cap}` × difficulty `{0, .5, 1}`:
   generate 200 emissions each and assert all five rules structurally.
6. **Oracle test** — a scripted perfect player (throws at `windowOpenS + ε`, holds until the
   hazard is behind, releases before `extent` reaches `0.8 × maxExtent`) survives 10,000 seeded
   runs of 500 hazards. Any death is a generator bug, and the seed is the bug report.
7. Render: obstacles as lane-width boxes coloured by kind, curves via the existing road bend.

### Exit gate
- Property test and oracle test green across the full parameter grid.
- One seed committed as the canonical regression run.

---

## Phase 4 — Light as difficulty

**Objective:** headlight power shortens what you can see, down to the floor, and never past it.

### Data model

```ts
// components/Light.ts
interface Light {
  power: number;           // 0..1
  highBeam: number;        // 0..1, its own meter
  highBeamActive: boolean;
}
```

### Rules

- `coneLength = lerp(light.minCone, light.maxCone, power)`; if `highBeamActive`, `light.highBeamCone`.
- Obstacles render with alpha `clamp((coneLength - (s - car.s)) / light.fadeMetres)`.
- **Anchor glow (G0.2):** `glowRadius = max(coneLength × light.anchorGlowFactor, speed × rope.floorSeconds + rope.closeMargin)`.
  Anchors are visible from `glowRadius` regardless of the cone; the floor term is the reaction
  guarantee.
- Drain: `power -= (light.drainPerSecond × dt + light.drainPerMetre × ds)`, clamp ≥ 0.
- High beam: on pickup, `highBeam = 1`, `highBeamActive = true`; drains `light.highBeamDrainPerSecond`;
  at 0 → inactive. Does not touch `power`.
- Pickups: attaching to a `power` anchor adds `light.powerPickup`; to a `highBeam` anchor
  activates it. Collection happens on attach, so the swing is the collection.

### Config keys introduced

`light.minCone = 40`, `light.maxCone = 160`, `light.highBeamCone = 260`,
`light.fadeMetres = 15`, `light.anchorGlowFactor = 1.3`, `light.drainPerSecond = 0.012`,
`light.drainPerMetre = 0.0004`, `light.powerPickup = 0.35`,
`light.highBeamDrainPerSecond = 0.25`, `hazards.pickupChance = { power: 0.18, highBeam: 0.08 }`

### Tasks
1. `LightSystem` (pure) — cone, drain, high-beam lifecycle.
2. `PickupSystem` (pure) — collection on attach.
3. Generator: second anchor of kind `power`/`highBeam` on the same safe side, placed ahead of
   the safe anchor so nearest-ahead selection yields the temporal choice (G0.4).
4. Render: cone as a gradient triangle from the car; obstacle alpha; anchor glow pulse
   brightness by kind; two meters bottom-left per §13.
5. **Floor test** — for speed in `{start, cap}` and `power = 0`, assert
   `(windowCloseS - windowOpenS) / speed ≥ rope.floorSeconds` for every generated anchor. This
   is rule 4.3.4 and §8.4 as one executable assertion.

### Exit gate
- Floor test green.
- Screenshot at `power = 0`, max speed: anchor visible, obstacle barely so.

---

## Phase 5 — Progression, scoring, failure, restart

**Objective:** a complete run from first frame to game over to restart, with the ramp and cap
matching config.

### Rules

- `ramp(t) = smoothstep(clamp(t / speed.rampSeconds))`.
- `speed = speed.start + (speed.cap - speed.start) × ramp(t)`, `speed.cap = 3 × speed.start`.
- `difficulty = ramp(t)` drives spawn interval and combo probability (G0.3); both hold at
  `t ≥ rampSeconds`.
- `score = floor(elapsedSeconds)`; best in `localStorage` under `nightline.best`.
- Collision → `impactSeconds` beat (input ignored, screen shake) → game-over overlay with
  score, best, seed → any press → fresh run. `Rope`, `Light`, `Track`, generator and RNG all
  reset; RNG reseeds from `Date.now()` unless a `?seed=` query param is present.

### Config keys introduced

`speed.start = 30`, `speed.rampSeconds = 330`, `score.pointsPerSecond = 1`,
`fail.impactSeconds = 0.6`

### Tasks
1. `ProgressionSystem` (pure) + unit test: `speed(0) = start`, `speed(rampSeconds) = cap`,
   `speed(rampSeconds + 600) = cap`, monotone non-decreasing.
2. `ScoreSystem` (pure).
3. `PlayScene` run lifecycle; game-over overlay; `?seed=` support.
4. Harness: scripted 6-minute oracle run asserting speed tracks config within 1%, then a
   forced crash and a restart with a clean world (all pools recycled, no orphaned entities).

### Exit gate
- The 6-minute harness run passes at ≥ 55 fps for its duration on both viewports.
- The game is complete and playable end-to-end with primitives.

---

## Phase 6 — Art and audio

**Objective:** replace primitives with the §11/§12 asset set without touching game logic.

- Colour token file (`assets/tokens.json`) referenced by every SVG.
- `scripts/build-atlas.mjs` — rasterise SVG (resvg-js) → pack into sheets with uniform cells,
  fixed registration, one row per state → emit the §12 metadata JSON per sheet.
- `AnimationSystem` maps entity state → sheet row; transform-only.
- `AudioSystem` per §15; engine pitch bound to `speed`; rope taut pitch bound to `Rope.tension`.
- Environment sets (desert, city) swap per stretch as parallax layers.

### Exit gate
- Registration regression: every frame of every state has its centre within 1 px of its
  neighbours (computed from the sheets in a test).
- Before/after screenshots in `docs/verification/phase6-*.png`.
- Initial download still under 5 MiB.

---

## Phase 7 — Platform sign-off

**Objective:** nothing new is built here. Phase 7 is the point where the cross-cutting matrix
is run at full strictness against the finished game and any drift is fixed.

- Full verification matrix green, including `throttled` at ≥ 30 fps for a 3-minute run and
  `embed` playing inside the iframe with input reaching the game.
- Manual pass on real hardware: one iPhone (Safari, portrait and landscape, notch present),
  one Android (Chrome, low-end if available), one desktop each of Safari, Firefox, Chrome/Edge.
  Recorded as a checklist in `docs/verification/phase7-devices.md`.
- Audio unlock on first gesture confirmed on iOS; no autoplay warnings in any console.
- Arkadium path behind a feature flag: `npm i @arkadiuminc/sdk`, `sdk.lifecycle.onTestReady()`
  after the first rendered frame; verified in the `embed` project with the SDK stub.
- Bundle-size assertion in `npm run build` (initial download < 5 MiB).

### Exit gate
- Matrix green; device checklist complete; embed plays; bundle under budget.

---

## Tuning surface — `public/config.json`

```
display   { scaleMode, fullscreen, maxDevicePixelRatio, portraitBreakpoint }
input     { edgeGuardPx, gamepad }
performance { targetFps }
lanes     { count, width }
road      { halfWidth, horizonMetres, tailMetres, segmentLength, postSpacing }
camera    { height, depth }
drift     { gain }
speed     { start, rampSeconds }                       // cap = 3 × start
rope      { baseRange, floorSeconds, closeMargin, maxExtent, throwDuration,
            pullDuration, returnDuration, missCooldown, holdMin }
curves    { slight, sharp, slightLength, sharpLength }
hazards   { spawnLeadSeconds, minIntervalSeconds, maxIntervalSeconds,
            comboThreshold, weights, pickupChance }
light     { minCone, maxCone, highBeamCone, fadeMetres, anchorGlowFactor,
            drainPerSecond, drainPerMetre, powerPickup, highBeamDrainPerSecond }
score     { pointsPerSecond }
fail      { impactSeconds }
audio     { <logical name>: <file> }
debug     { autoCentre, showSeed }
```

All initial values above are placeholders to make the game run, not tuned numbers. Tuning
happens in Phase 2 (rope) and Phase 5 (ramp) against a controller, and is a config edit.

## Risks (carried)

1. **The verb may not read.** Phase 2's exit gate is a person, not a test.
2. **Art volume** stays off the critical path until Phase 6.
3. **Lane legibility in the dark** (§5 vs §14) — plan: lane dashes near the car are self-lit
   to `light.minCone`, so the current lane is always readable.
4. **Rope snap must be telegraphed** — `Rope.tension` is exposed from Phase 2 so render and
   audio can warn before the snap.
