# Project Structure

Atari Night Drive is a 2D game built with [Phaser 4](https://docs.phaser.io/), TypeScript
and Vite. It follows an **ECS (Entity-Component-System)** architecture so that gameplay
logic stays decoupled from input handling — letting us support multiple input systems
(currently touch and keyboard) without duplicating game code.

## Directory Layout

```
.
├── src/
│   ├── scenes/         # Phaser scenes (boot, menu, play) — wire systems together
│   ├── entities/       # entity definitions / factories
│   ├── components/     # plain data containers attached to entities
│   ├── systems/        # logic that operates on components each frame
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
└── package.json        # dependencies and npm scripts (dev, build, preview)
```

## `src/`

### `scenes/`
Phaser scenes — boot, menu, play. A scene loads assets, creates entities and registers the
systems that should run. Scenes wire things together; they hold no gameplay rules.

Never store the canvas size in module-level constants. Read `this.cameras.main.width` /
`.height` inside `create()` and listen on `this.scale.on('resize', ...)`, or the layout
breaks on rotation and toolbar collapse.

### `entities/`
An entity is just an id with a set of components — no behaviour of its own.
This folder holds the factories that assemble them (e.g. `player.ts`, `enemyCar.ts`,
`roadSegment.ts`), each returning an entity composed of the components it needs.

### `components/`
Pure data, no logic. Examples: `Position`, `Velocity`, `Sprite`, `Input`, `Collider`,
`EngineSound`. Components are what systems query against, so keep them small and
single-purpose.

### `systems/`
All behaviour lives here. Each system iterates over the entities that have the
components it cares about and updates them once per frame. Examples:

- `RenderSystem` — draws sprites via Phaser
- `MovementSystem` — applies velocity to position
- `CollisionSystem` — hit detection and response
- `AudioSystem` — plays sounds resolved from the config mapping
- **Input systems** — `KeyboardInputSystem` and `TouchInputSystem`

Input is the main reason for the ECS split: each input system writes to the same
`Input` component, so gameplay systems never need to know whether the player is
on a keyboard or a touchscreen. Adding a new input method (gamepad, tilt) means
adding one system, not touching gameplay code.

## `public/`

Served verbatim by Vite and copied into the build output — everything the game fetches at
run time.

### `config.json`
Externalises settings so they can be changed without a rebuild:

- **Display** — screen width/height, scale mode, fullscreen
- **Performance** — target fps
- **Audio mapping** — logical sound name → file, e.g. `"enginesound": "vroom.mp3"`
- Any other tunable game settings

Systems read values from this config rather than hardcoding them. Because it lives in
`public/`, it ships as a static file and can be edited in a deployed build.

### `assets/`
- `sounds/` — audio files referenced by the config's sound mapping
- `sprites/` — static sprite images
- `sprites/animations/` — spritesheets and animation frame sets

## Tooling

npm scripts are the entry point for common tasks:

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production bundle
- `npm run preview` — serve the production bundle locally

See `CLAUDE.md` for the Phaser 4 API traps and the `phaser4-gamedev` plugin commands
(`/phaser-run`, `/phaser-playtest`, `/phaser-validate`) that drive and verify the game.
