# Atari Night Drive

A one-button endless night-driving game built with **Phaser 4**, TypeScript and Vite.
Descended from Atari's *Night Driver* (1976), whose roadside reflector posts become the
thing you survive by.

**The verb:** the car drives itself. Press space to throw a rope at a lit anchor post and
swing into its lane, past whatever is about to kill you. Three timing skills out of one key
— when to press, how long to hold, when to let go — and three ways to die: hit the obstacle,
return to centre too early, or hold until the rope reaches its extent and snaps.

Headlight power drains continuously and decides how far ahead you can see, so **visibility
is the difficulty curve**. It must always make the game *later*, never impossible: the
reaction window has a floor that low power can never push below. That property is the best
thing about the design and the easiest to break — see `AnchorSystem.ropeRange` and
`LightSystem.glowRadius`.

`docs/` in the reference project carries the full GDD; the rules that matter are documented
at the top of the system that enforces them.

## Toolchain

| Piece | Choice |
|---|---|
| Engine | Phaser 4 (**not** Phaser 3 — see API Drift below) |
| Language | TypeScript |
| Bundler / dev server | Vite |
| Package manager | npm |

Build and run go through npm scripts. A `makefile` wraps them for convenience — every
target shells out to npm, so `package.json` stays the source of truth. There is no `bin/`
directory.

| Command | Does |
|---|---|
| `make help` | list targets (the default target is `all`, so ask for `help` explicitly) |
| `make deps` | `npm install`, skipped when `node_modules` is already current |
| `make dev` | dev server on `http://localhost:8000/` |
| `make build` | typecheck, then build into `dist/` |
| `make preview` | **builds first**, then serves `dist/` — never a stale build |
| `make playtest` | boots the game headless in Chromium and asserts it plays |
| `make verify` | typecheck + build + playtest, the full gate |
| `make typecheck` | `tsc --noEmit` |
| `make clean` / `make distclean` | drop `dist/` / also drop `node_modules` |

Port is overridable (`make dev PORT=3000`). The ports differ between the two entry points:
bare `npm run preview` uses Vite's default 4173, while `make preview` forces 8000.

## Architecture — ECS

Gameplay logic is split Entity–Component–System so that **input handling stays out of
gameplay code**. This is the load-bearing reason for the architecture; preserve it.

- `src/entities/` — factories that assemble an entity from components. No behaviour.
- `src/components/` — pure data containers. No logic, no methods. Everything here is
  **generic and visual**: `Transform`, `Shape`, `Sprite`, `Text`, `Collision`, `UserInput`,
  `Animation`, re-exported from `src/components/index.ts` along with the `ComponentMap`
  that makes `entity.get(TRANSFORM)` come back typed.

  There are deliberately **no components named after game objects**. A car is an entity
  built from `Transform` + `Sprite` + `Animation`, never a `Car` component. If you find
  yourself writing one, what you want is an entity factory.
- `src/world.ts` — gameplay state that has no transform and therefore is not a component:
  track curvature, headlight power, rope state machine, run state, the anchor and hazard
  records. Plain data, owned by the scene, handed to systems. **Imports nothing from
  Phaser** — the world is metres and seconds, never pixels.
- `src/systems/` — all behaviour, in two layers. Gameplay systems read and write the world
  (`RopeSystem`, `HazardGenerator`, `CollisionSystem`, …) and are testable with no canvas.
  View systems (`RoadViewSystem`, `ActorViewSystem`, `HudViewSystem`) read the world and
  write component values onto entities; `RenderSystem` then draws entities and nothing else.
- `src/scenes/` — Phaser scenes (boot, menu, play). Scenes wire systems together; they do
  not contain gameplay rules. If a rule lands in `GameScene`, it is in the wrong file.

`CameraSystem` is the only place metres become pixels. Everything upstream of it is world
units; everything downstream reads `world.projection`.

Every input system writes to the same `UserInput` component, so gameplay systems never
learn whether the player is on a keyboard, a touchscreen or a gamepad. Adding an input
method means adding one system and touching nothing else.

## Runtime config

Tunables live in `public/config.json`, loaded at runtime and never hardcoded in systems:
display, target fps, input, and the whole gameplay tuning surface (`lanes`, `road`,
`camera`, `speed`, `rope`, `curves`, `hazards`, `light`, `score`, `fail`). `src/config.ts`
defaults every field, so a hand-edited config with a missing key still boots.

`assets.sprites` maps a logical key (`'car.body'`) to an SVG and a rasterisation scale;
`assets.animations` does the same for frame strips. Systems ask for textures by logical key
only — the path appears exactly once, in the config — so re-skinning is a config edit.

`audio.sounds` is empty on purpose: every sound is synthesised in `AudioSystem`, which is
why there are no files under `public/assets/sounds/`.

## Assets

`public/assets/` — served as static files by Vite. Art is SVG, rasterised once at load.

- `public/assets/tokens.json` — the colour source. Every SVG sets a literal hex **and**
  carries `data-token="<name>"` on the same element, so a re-theme is one file plus a
  rewrite pass, with no SVG hand-edited.
- `public/assets/sprites/{car,anchor,obstacle,road,rope,ui}/` — one file per asset
- `public/assets/sounds/` — empty; audio is synthesised, not loaded

**No sprite atlas, on purpose.** Animation is transform-only — states come from scaling,
rotating and fading art, never from morphing paths — so there are no per-frame pixel
differences an atlas could store, and it would only add download size and blur at
non-native scale. The one real sheet is the pedestrian walk cycle, authored as four cells
in a single SVG; `BootScene` slices the rasterised texture into frames by hand, which is
what lets `AnimationSystem` drive it.

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

Compiling is not working. Two harnesses exist, and both should be green before claiming a
gameplay change works:

```bash
npm run playtest   # or: make playtest — needs `npm run dev` already running
npm run verify     # typecheck + build + playtest
```

`scripts/playtest.mjs` boots the real game in Chromium, drives an autopilot through real key
events, and asserts the car travels, the rope attaches, power drains, the frame rate holds
and the console is clean. Screenshots land in `docs/verification/`.

Gameplay systems are Phaser-free by design, so they can also be simulated headlessly at
thousands of frames a second — that is how the fairness invariants (no hazard blocking all
three lanes, every hazard reachable by an anchor, no throw window below the reaction floor)
are checked across many seeds. Prefer that for rule changes; it is far faster than a
browser.

Playwright is installed as a devDependency; the browser binary is per-machine:

```bash
npx playwright install chromium
```

`src/main.ts` already exposes the game for deep checks, under a `DEV` guard so the handle
never ships:

```ts
if (import.meta.env.DEV) (window as any).__PHASER_GAME__ = game;
```

If `src/` uses `import.meta.env`, `tsconfig.json` must include `"types": ["vite/client"]`
or `tsc` fails with TS2339.
