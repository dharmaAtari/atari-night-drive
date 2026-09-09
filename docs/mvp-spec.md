> **Superseded** by [implementation-plan.md](./implementation-plan.md) on 2026-09-09. Kept for provenance.

# Night Drive — MVP Spec

Modern, endless reimagining of Atari's **Night Driver** (October 1976). Web-first, mobile-
playable, 60 fps, embeddable in an iframe.

## Fidelity anchor

The original's whole visual system was **16 white rectangles** per frame, positions computed
in software and written to hardware as x/y/width/height. There was no road surface, no
projection matrix and no player car — the car was a decal on the monitor glass. We keep the
16-reflector model literally; it is the game's identity and it is free to run.

Source: [MAME nitedrvr.cpp](https://github.com/mamedev/mame/blob/master/src/mame/atari/nitedrvr.cpp),
[Wikipedia](https://en.wikipedia.org/wiki/Night_Driver_(video_game)).

## What changes from 1976

| 1976 | Here | Why |
|---|---|---|
| 50–125 s timer | none | endless |
| Score wraps at 1000 | uncapped distance | endless |
| Crash = stop, lose time | crash = run over | with no timer a crash costs nothing |
| 3 memorizable tracks | procedural, seeded | endless |
| Wheel + pedal + 4-gear shifter | steer only, auto-throttle | no shifter on a phone; the 1980 2600 port also dropped gears |
| Car not rendered (glass decal) | hood silhouette drawn | spatial reference on a small screen |

## Core loop

Drive → survive → distance climbs → speed climbs → crash → score → restart.

- **Score** = metres travelled. Best score persisted locally.
- **Difficulty** ramps continuously with distance: speed up, curves tighter and more frequent.
- **Crash** = leaving the road. Screen inverts (the original flashed by swapping the palette),
  run ends.

## Controls

One axis. Steering only; throttle is automatic.

| Input | Steer left | Steer right |
|---|---|---|
| Touch | hold left half of screen | hold right half |
| Mouse | hold left half | hold right half |
| Keyboard | `←` / `A` | `→` / `D` |

All three write to the same `InputState` component. No gameplay system knows which was used.

## Rendering model

Per frame, for each of 16 reflectors:

1. `RoadSystem` advances `z` toward the camera; a reflector past the camera recycles to the
   far plane with the next curve sample.
2. `ProjectionSystem` maps `(z, side, roadCurve, playerOffset)` to screen `x, y, w, h` with a
   `1/z` scale.
3. `RenderSystem` fills those rectangles. Nothing else is drawn except the hood and HUD.

## Non-goals for the MVP

Traffic cars, scenery props, audio, gears, multiple tracks, leaderboards, ads, and the
Arkadium SDK. All are additive on top of a working core.

## Verification

- `npm run typecheck` clean.
- `npm run build` succeeds.
- Game boots headless in Chromium, reports a live Phaser instance, and holds 60 fps.
