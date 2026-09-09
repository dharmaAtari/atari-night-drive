# Phase 7 — Real-device checklist

The Playwright matrix emulates viewports and throttles CPU. It does not prove behaviour on
real hardware: touch latency, Safari chrome collapsing, notch insets, GPU driver differences
and audio unlock all differ on device. This checklist is the part of Phase 7 that cannot be
automated.

Fill in `Result` and `Notes`. Anything not "pass" blocks the phase.

## What to check on every device

| # | Check | Why it is here |
|---|---|---|
| 1 | Game boots to a visible road within ~2 s | Catches WebGL/Canvas fallback failures |
| 2 | Holding anywhere throws the rope; releasing detaches | The whole game is one button |
| 3 | Rope tension visibly changes colour before it snaps | GDD §4.2 — snap must never be the first signal |
| 4 | Score and both meters are fully visible, clear of notch/home bar | GDD §13 + safe-area insets |
| 5 | Rotate mid-run: layout re-lays out, run continues, no error | Orientation is never locked |
| 6 | Collapse/expand browser chrome mid-run (scroll gesture) — no dead strip | `visualViewport` height source |
| 7 | Audio starts on first press, not before | iOS requires a gesture to unlock |
| 8 | Crash → game over → press → new run, with no visual leftovers | `resetRun` pooling |
| 9 | Sustained frame rate feels smooth for 60 s | Software-GL proxy numbers are not evidence |
| 10 | Backgrounding and returning does not kill the run mid-hold | Blur must read as detach, not snap |

## Devices

| Device / browser | OS version | Result | Notes |
|---|---|---|---|
| iPhone — Safari | | | notch + home bar present |
| iPhone — Safari, landscape | | | |
| Android — Chrome | | | low-end if available |
| Android — Chrome, landscape | | | |
| Desktop — Chrome/Edge | | | |
| Desktop — Firefox | | | |
| Desktop — Safari (macOS) | | | the only real WebKit signal |

## Known automation gaps

- `desktop-webkit` and `phone-portrait` Playwright projects cannot run on this WSL image:
  the WebKit binary is installed but ~40 system libraries are missing. Unblock with
  `sudo env "PATH=$PATH" $(which npx) playwright install-deps webkit`.
- `phone-landscape` measures ~47 fps in headless Chromium's SwiftShader software renderer at
  a 1726×720 surface. That is a proxy artefact, not a device measurement — check 9 above is
  the real signal.
- Canvas (no-WebGL) is a *boots-and-is-playable* tier only. Filters are WebGL-only in
  Phaser 4, so never gate screenshot parity on it.
