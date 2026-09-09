# Project Structure

Atari Night Drive is a 2D game built with [Phaser 4](https://docs.phaser.io/), TypeScript
and Vite. It follows an **ECS (Entity-Component-System)** architecture so that gameplay
logic stays decoupled from input handling — letting us add input methods (keyboard today,
touch and gamepad later) without duplicating game code.

## Directory Layout

```
.
├── src/
│   ├── scenes/         # Phaser scenes — own their own scene logic
│   │   ├── BaseScene.ts    # the ECS frame loop every scene inherits
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   └── keys.ts         # scene keys, so scenes need not import each other
│   ├── entities/       # entity container + factories
│   │   └── Entity.ts       # id + component bag; the one class with methods
│   ├── components/     # plain data containers attached to entities
│   ├── systems/        # logic that operates on components each frame
│   ├── config.ts       # loads and validates public/config.json
│   └── main.ts         # Phaser bootstrap + game config entry point
├── public/
│   ├── config.json     # runtime settings (screen size, fps, sound mapping, ...)
│   └── assets/
│       ├── sounds/     # audio files (engine, ui, ambience)
│       └── sprites/
│           └── animations/  # spritesheets / animation frames
├── index.html          # Vite entry document
├── vite.config.ts      # dev server + build config
├── tsconfig.json       # TypeScript config
├── makefile            # thin wrapper over the npm scripts
└── package.json        # dependencies and npm scripts (dev, build, preview)
```

## `src/`

### `scenes/`
Phaser scenes — menu and play today. A scene creates its entities, registers the systems
that should run, and **owns the logic for that screen**: which menu row is selected, when
to hand off to another scene, what a button press means *here*. That logic lives on the
scene rather than in a system because it is scene-specific and short-lived — it dies with
the screen it belongs to, and only the scene has the authority to start another scene.

The split is by lifetime and reach, not by "logic vs no logic":

- **Systems** hold behaviour that applies to *any* entity with the right components and
  runs every frame regardless of which screen is up — rendering, movement, collision,
  input sampling.
- **Scenes** hold behaviour that only makes sense for one screen — menu navigation,
  transitions, win/lose conditions.

If a rule would read identically in two scenes, it belongs in a system. If it names a
specific screen's entities, it belongs in the scene.

`BaseScene` fixes the frame order so a subclass cannot get it wrong: device input is
sampled, fanned out to every entity carrying a `UserInput`, and only then does scene logic
run — so entity input is always current when the scene reads it, and rendering happens
last on the transforms that logic just wrote. Subclasses fill in three hooks rather than
overriding `update()`:

- `build()` — create entities
- `layout(width, height)` — position them for the current canvas size
- `updateEntities(time, delta)` — this screen's per-frame logic

Never store the canvas size in module-level constants. `layout()` runs on create and again
on every resize; read `this.cameras.main.width` / `.height` and listen on
`this.scale.on('resize', ...)`, or the layout breaks on rotation and toolbar collapse.

The scene's own input component is `this.userInput` — never `this.input`, which belongs to
Phaser's input plugin.

### `entities/`
An entity is an id with a set of components and no behaviour of its own. `Entity.ts` is
the container itself (`add` / `get` / `has` / `remove`); everything else in this folder is
a factory that assembles one from components and returns it.

Current: `menuOption.ts`, `selectionBox.ts`. As the game fills in: `player.ts`,
`enemyCar.ts`, `roadSegment.ts`.

Factories return entities, not subclasses — an entity with methods on it stops being an
entity.

### `components/`
Pure data, no logic. Each is a factory returning a plain object keyed by its own `type`.
Components are what systems query against, so keep them small and single-purpose.

| Component | Holds |
|---|---|
| `Transform` | position, rotation, scale, depth — what everything else is placed by |
| `Shape` | a vector primitive for the renderer (rect, circle, line, polygon, ...) |
| `Text` | a string plus its Phaser text style |
| `Collision` | collider bounds, layer/mask bits, contacts *(defined; no system reads it yet)* |
| `UserInput` | `up` / `down` / `action`, each as `down` / `justDown` / `justUp` |
| `Animation` | spritesheet path, frame count, frame rate, loop flag, playback cursor, `animationEnded` |

`components/index.ts` is the barrel: it re-exports every component and keeps the
`ComponentType` key map and the `ComponentMap` type that makes `entity.get(TRANSFORM)`
come back typed.

Still to add as the game grows: `Velocity`, `Sprite`, `EngineSound`.

### `systems/`
Cross-scene, per-frame behaviour. Each system iterates the entities that have the
components it cares about and updates them.

Built:

- `RenderSystem` — draws `Shape` and `Text` entities via Phaser, creating each game object
  once and syncing changed fields thereafter
- `KeyboardInputSystem` — samples the keyboard into a `UserInput`
- `UserInputSystem` — copies the scene's `UserInput` onto every entity that carries one
- `AnimationSystem` — steps each `Animation` at its own frame rate, wrapping or ending it
  per its `loop` flag

Planned: `MovementSystem` (velocity → position), `CollisionSystem` (hit detection and
response, filling `Collision.contacts`), `AudioSystem` (plays sounds resolved from the
config mapping), `TouchInputSystem`.

Input is the main reason for the ECS split: every input system writes to the same
`UserInput` component, so gameplay never learns whether the player is on a keyboard or a
touchscreen. Adding a new input method (touch, gamepad, tilt) means adding one system, not
touching gameplay code. `KeyboardInputSystem` is currently the only file in the codebase
that knows a keyboard exists — keep it that way.

## `public/`

Served verbatim by Vite and copied into the build output — everything the game fetches at
run time.

### `config.json`
Externalises settings so they can be changed without a rebuild:

- **Display** — width, height, scale mode, auto-centre, fullscreen, background, pixel art
- **Performance** — target fps
- **Audio mapping** — volume, and logical sound name → file, e.g. `"enginesound": "vroom.mp3"`

`src/config.ts` fetches and validates it, defaulting every field rather than trusting the
file — it ships as a static asset and can be edited in a deployed build. `main.ts` applies
`display` and `performance` to the Phaser game config and parks the whole object in
`game.registry` under `'config'`, so any scene can reach it via
`this.game.registry.get('config')`. The `audio` section is parsed and waiting on
`AudioSystem`; nothing reads it yet.

Systems read values from this config rather than hardcoding them.

### `assets/`
- `sounds/` — audio files referenced by the config's sound mapping
- `sprites/` — static sprite images
- `sprites/animations/` — spritesheets and animation frame sets

## Tooling

npm scripts are the source of truth for common tasks:

- `npm run dev` — Vite dev server with HMR (port 8000, set in `vite.config.ts`)
- `npm run build` — typecheck, then production bundle into `dist/`
- `npm run preview` — serve the production bundle locally
- `npm run typecheck` — `tsc --noEmit` on its own

The `makefile` wraps these (`make dev`, `make build`, `make preview`, `make typecheck`,
`make clean`); `make help` lists the targets. It shells out to npm and adds no build logic
of its own.

See `CLAUDE.md` for the Phaser 4 API traps and the `phaser4-gamedev` plugin commands
(`/phaser-run`, `/phaser-playtest`, `/phaser-validate`) that drive and verify the game.
