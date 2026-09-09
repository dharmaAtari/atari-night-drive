# Atari Night Drive

A 2D night-driving game built with **Phaser 4**, TypeScript and Vite.

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
| `make typecheck` | `tsc --noEmit` |
| `make clean` / `make distclean` | drop `dist/` / also drop `node_modules` |

Port is overridable (`make dev PORT=3000`). The ports differ between the two entry points:
bare `npm run preview` uses Vite's default 4173, while `make preview` forces 8000.

## Architecture — ECS

Gameplay logic is split Entity–Component–System so that **input handling stays out of
gameplay code**. This is the load-bearing reason for the architecture; preserve it.

- `src/entities/` — factories that assemble an entity from components. No behaviour.
- `src/components/` — pure data containers. No logic, no methods. Keep them small and
  single-purpose. Today: `Transform`, `Shape`, `Text`, `Collision`, `UserInput`,
  `Animation` — all re-exported from `src/components/index.ts`, which also holds the
  `ComponentMap` that makes `entity.get(TRANSFORM)` come back typed.
- `src/systems/` — all behaviour. Each system queries the entities holding the components
  it cares about and updates them once per frame.
- `src/scenes/` — Phaser scenes (boot, menu, play). Scenes wire systems together; they do
  not contain gameplay rules.

Every input system writes to the same `UserInput` component, so gameplay systems never
learn whether the player is on a keyboard, a touchscreen or a gamepad. Adding an input
method means adding one system and touching nothing else.

## Runtime config

Tunables live in a config file loaded at runtime, not hardcoded in systems: display
width/height, scale mode, fullscreen, target fps, and the logical-sound-name → file map
(e.g. `"enginesound": "vroom.mp3"`). Systems read from config.

## Assets

`public/assets/` — served as static files by Vite.

- `public/assets/sounds/` — audio referenced by the config's sound map
- `public/assets/sprites/` — static sprite images
- `public/assets/sprites/animations/` — spritesheets and animation frame sets

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

`src/main.ts` already exposes the game for deep checks, under a `DEV` guard so the handle
never ships:

```ts
if (import.meta.env.DEV) (window as any).__PHASER_GAME__ = game;
```

If `src/` uses `import.meta.env`, `tsconfig.json` must include `"types": ["vite/client"]`
or `tsc` fails with TS2339.
