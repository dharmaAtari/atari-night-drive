# Project Structure

Atari Night Drive is a 2D game built with [Phaser](https://docs.phaser.io/) (JavaScript).
It follows an **ECS (Entity-Component-System)** architecture so that gameplay logic stays
decoupled from input handling — letting us support multiple input systems (currently
touch and keyboard) without duplicating game code.

## Directory Layout

```
.
├── src/
│   ├── entities/       # entity definitions / factories
│   ├── components/     # plain data containers attached to entities
│   ├── systems/        # logic that operates on components each frame
│   └── main.js         # Phaser bootstrap + game loop entry point
├── bin/
│   ├── config.xml      # runtime settings (screen size, fps, sound mapping, ...)
│   └── assets/
│       ├── sounds/     # audio files (engine, ui, ambience)
│       └── sprites/
│           └── animations/  # spritesheets / animation frames
└── makefile            # build, run and packaging targets
```

## `src/`

### `entities/`
An entity is just an id with a set of components — no behaviour of its own.
This folder holds the factories that assemble them (e.g. `player.js`, `enemyCar.js`,
`roadSegment.js`), each returning an entity composed of the components it needs.

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

## `bin/`

The runtime/distributable side of the project — everything the game loads at run time.

### `config.xml`
Externalises settings so they can be changed without a rebuild:

- **Display** — screen width/height, scale mode, fullscreen
- **Performance** — target fps
- **Audio mapping** — logical sound name → file, e.g. `enginesound: vroom.mp3`
- Any other tunable game settings

Systems read values from this config rather than hardcoding them.

### `assets/`
- `sounds/` — audio files referenced by the config's sound mapping
- `sprites/` — static sprite images
- `sprites/animations/` — spritesheets and animation frame sets

## `makefile`
Top-level entry point for common tasks (build, run/serve, clean, package), so the
project can be driven with plain `make` commands.
