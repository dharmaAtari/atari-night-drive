# Night Line

A third-person, one-button endless night driver: press and hold to rope-swing the car
between lanes around hazards that resolve out of the dark. Built with **Phaser 4**,
TypeScript and Vite.

Sources of truth: [docs/GDD.md](docs/GDD.md) (design) and
[docs/implementation-plan.md](docs/implementation-plan.md) (architecture, phases,
coordinate model, system order). This file is instructions for the coding agent, not a
design doc — when the two disagree, the docs win and this file is stale.

## Toolchain

| Piece | Choice |
|---|---|
| Engine | Phaser 4 (**not** Phaser 3 — see API drift below) |
| Language | TypeScript |
| Bundler / dev server | Vite |
| Package manager | npm |
| Test runner | Vitest — runs every system except Render/Input, no browser needed |

There is no `makefile` and no `bin/` directory. Build and run go through npm scripts.

## Architecture — ECS

Only `*Render*` and `*Input*` systems may import Phaser. Every other system —
`Progression`, `Track`, `HazardGenerator`, `Anchor`, `Rope`, `Drift`, `Light`, `Pickup`,
`Collision`, `Score`, `Camera` — is pure TypeScript with no Phaser import, so it runs
under Vitest without a browser. This is the load-bearing reason for the architecture;
preserve it.

- `src/entities/` — factories that assemble an entity from components. No behaviour.
- `src/components/` — pure data containers. No logic, no methods.
- `src/systems/` — all behaviour. Pure, except the Render systems and
  `OneButtonInputSystem`.
- `src/scenes/` — Phaser scenes wire systems together; they do not contain gameplay rules.

### Coordinate model

- **`s`** — longitudinal metres along the track. Car sits at `carS`; world advances
  `speed × dt`. Everything ahead has `s > carS`.
- **`x`** — lateral lane units. Lane width = 1. Lane centres at `x ∈ {-1, 0, +1}`. Road
  edges at `±roadHalfWidth` (1.5). Car `x` is continuous — the three lanes are
  attractors, not discrete slots. Off-road when `|x| > roadHalfWidth`.
- **`κ`** (curvature) — signed, per track segment. `κ > 0` turns right and drifts the car
  toward `-x`. Drift is zero while the rope is attached.
- Throw windows, glow radii and spawn lead are distances in metres ahead of the car,
  derived from speed every frame — never a fixed duration.

### Per-frame system order

```
OneButtonInput → Progression → Track → HazardGenerator → Anchor → Rope
→ Drift → Light → Pickup → Collision → Score → Camera → RoadRender → HUD
```

Input writes `InputState`; nothing downstream reads Phaser input. Render reads the
world; nothing upstream reads the renderer.

### Gate 0 — resolved decisions

| # | Decision |
|---|---|
| G0.1 | Curvature applies continuous outward drift ∝ `curvature × speed`; lanes are attractors, car `x` is continuous |
| G0.2 | Headlight power scales anchor glow radius, floored at the reaction-window distance for current speed |
| G0.3 | Hazard density and combo rate ramp on the same curve as speed, cap together, then hold |
| G0.4 | Up to 2 anchors on screen; selection = nearest ahead of the car; pickups are the second anchor on the same safe side |

## Runtime config

Tunables live in `public/config.json`, read at runtime, never hardcoded in systems:
lanes, road, camera, drift, speed, rope, curves, hazards, light, score, fail, audio,
debug. `src/config.ts` loads it; systems read from config, not from constants. See
implementation-plan.md "Tuning surface" for the full key list.

## Assets

`public/assets/` — served as static files by Vite. See docs/GDD.md §11–12 for the full
asset and animation catalogue (car, rope/anchors, obstacles, road, roadside, UI).

## Phaser 4 API drift

Phaser 4 removed a lot of Phaser 3 API. Most v3 calls still *compile* and fail at runtime
as a `TypeError` or a silent no-op. The `phaser4-gamedev` plugin installs a `Write|Edit`
hook that warns on the common ones, but **it only warns — it does not block the write.**
Read its output.

The traps that bite hardest:

- `Phaser.Geom.Point` → `Phaser.Math.Vector2`
- `preFX` / `postFX` → unified `Filters` (`obj.enableFilters()`, then
  `obj.filters.internal` / `obj.filters.external`)
- `BitmapMask`, `createBitmapMask()`, `createGeometryMask()` → removed entirely
- `camera.setScissor()` → does not exist; use `camera.setViewport()`
- `setPipeline()` → replaced by render nodes; `setPipeline('Light2D')` is now
  `setLighting(true)`
- `tintFill` → `setTint(...)` plus `setTintMode(Phaser.TintModes.FILL)`
- `Phaser.Structs.Map` / `Set` → native `Map` / `Set`
- `Camera3D` / `Layer3D` → removed; Phaser 4 is 2D only
- Never write module-level `GAME_WIDTH` / `GAME_HEIGHT` constants — they freeze at import
  time and break on rotation. Use `this.cameras.main.width/height` in `create()` plus a
  `this.scale.on('resize', ...)` listener.
- Always cap particle emitters with `maxParticles`. Uncapped emitters only fail under
  load, which means they fail for players and not for you.

## phaser4-gamedev plugin

Installed at project scope (`.claude/settings.json`), v0.7.0. Prefer these over
improvising — they encode Phaser 4 API knowledge that a model guesses wrong.

### Commands

| Command | Use |
|---|---|
| `/phaser-brainstorm` | Shape a game idea into something buildable and scoped |
| `/phaser-gdd` | Generate a Game Design Document |
| `/phaser-new` | Scaffold a new Phaser 4 project |
| `/phaser-run` | Start the dev server and verify the game boots |
| `/phaser-validate` | Validate project structure |
| `/phaser-analyze` | Audit architecture quality and performance risk |
| `/phaser-playtest` | Run the game headless and verify it actually works |
| `/phaser-build` | Production build |
| `/phaser-release` | Release gate |
| `/phaser-feedback` | Turn player feedback into a failing test, then a fix |

Intended loop: brainstorm → gdd → new → build → playtest → release → feedback ⟲

### Agents

`phaser-architect` (design/plan) · `phaser-coder` (implementation) ·
`phaser-debugger` (black screens, missing sprites, frame drops) ·
`phaser-asset-advisor` (loading, spritesheets, textures) ·
`phaser-playtester` (headless verification)

### Skills

- **Setup / lifecycle** — `phaser-init`, `phaser-build`, `phaser-release`, `phaser-migrate`
- **Core objects** — `phaser-scene`, `phaser-gameobj`, `phaser-ui`, `phaser-tilemap`
- **Motion / physics** — `phaser-physics` (Arcade), `phaser-matter` (Matter),
  `phaser-animation`
- **Presentation** — `phaser-fx`, `phaser-particles`, `phaser-audio`
- **Platform** — `phaser-input`, `phaser-mobile`, `phaser-saveload`
- **Planning** — `phaser-brainstorm`, `phaser-gdd`, `phaser-architect`
- **Verification** — `phaser-playtest`, `phaser-analyze`, `phaser-debugger`,
  `phaser-feedback`
- **Support** — `phaser-coder`, `phaser-asset-advisor`

## Verification

Compiling is not working. `/phaser-playtest` boots the game headless in Chromium and
asserts it actually runs — that is the real check before claiming a change works.

The harness needs Playwright, installed once per project:

```bash
npm install -D playwright && npx playwright install chromium
```

Expose the game for deep checks:

```ts
if (import.meta.env.DEV) (window as any).__PHASER_GAME__ = game;
```

If `src/` uses `import.meta.env`, `tsconfig.json` must include `"types": ["vite/client"]`
or `tsc` fails with TS2339.
