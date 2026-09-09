# atari-night-drive

A 2D night-driving game built with [Phaser 4](https://docs.phaser.io/), structured
around an ECS architecture so gameplay stays decoupled from input handling.
See [ProjectStructure.md](ProjectStructure.md) for the layout.

## Running it

Requires Node (for `npm install`) and Python 3 (for the static server).

```sh
make run
```

Then open <http://localhost:8000/>. You should get the menu: PLAY and QUIT with
a box around the selected row.

| key | does |
| --- | --- |
| up / W | move the selection up |
| down / S | move the selection down |
| space / enter | activate the selected row |

PLAY switches to the game scene, which is a placeholder — press space again to
come back. QUIT only emits a `menu:selected` event and logs, since a page cannot
close itself.

`make run` installs dependencies and vendors the Phaser runtime into `bin/lib/`
on first use. Use a different port with `make run PORT=9000`.

## Other targets

```sh
make build      # vendor Phaser into bin/lib/
make package    # write a self-contained tree to dist/
make clean      # remove bin/lib/ and dist/
```

## Configuration

Display size, target fps, background colour and the sound mapping all live in
[`bin/config.xml`](bin/config.xml) — change them and reload, no rebuild needed.
