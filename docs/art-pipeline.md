# Art pipeline

Companion to [GDD.md](./GDD.md) §11/§12/§14 and the Phase 6 entry in
[implementation-plan.md](./implementation-plan.md). This is the art **foundation** —
tokens, the SVG asset subset the game renders today, and the loading contract. It is not
the full §11 art order; see "Outstanding" below.

## Why no atlas

GDD §12 mandates transform-only animation (translate/scale/rotate/opacity, no path
morphing). With no per-frame pixel differences to store, a rasterised spritesheet atlas
would only add download size, memory and blur at non-native scale — it buys nothing. SVGs
ship as-is and Phaser rasterises each one to its own texture at load time (see "Loading"
below); states are produced by transforming that texture, not by switching frames in a
sheet. `scripts/build-atlas.mjs` referenced in the Phase 6 plan is superseded by this
decision and should not be built.

## Token contract

`public/assets/tokens.json` is the single colour source. Each entry is
`{ hex, use }` keyed by a semantic name (`anchorOpen`, `obstacleWarning`, …). Every SVG
shape sets `fill`/`stroke` to a token's literal hex **and** carries `data-token="<name>"`
on the same element. Re-theming is one edit to `tokens.json` plus a script (not yet
written) that walks `public/assets/svg/**` and rewrites `fill`/`stroke` wherever
`data-token` matches — no SVG needs hand editing to reskin.

Coverage: near-black base (`baseNight`), warm headlight pair (`headlightCore`/`Glow`),
cool cyan/white anchor pair (`anchorDormant`/`Open` — reserved so anchors never read as
hazards), one saturated warning colour (`obstacleWarning`, exclusive to obstacles and the
low-power HUD warning), road/shoulder/lane greys, `rearLightRed`, and the two pickup hues
(`pickupPower` green, `pickupHighBeam` violet — chosen distinct from each other and from
the anchor cyans).

## Registration points

Every object's states share one coordinate origin so nothing jitters when swapped or
transformed (§12):

- Car (`body.svg`, `rear-lights.svg`): identical `viewBox="0 0 60 90"`, car centred on
  `x=30`, wheels flush with the bottom edge (`y=90`). Lean is a runtime `rotate`/`skew`
  about this same box, not a separate asset.
- Anchor family (`post.svg`, `post-open.svg`, `pickup-power.svg`, `pickup-highbeam.svg`):
  identical `viewBox="0 0 20 120"`, pole base at bottom-centre (`x=10,y=120`). `post.svg`
  and `post-open.svg` are pixel-identical geometry, differing only in `data-token`/fill —
  the open state is a colour swap, not a redraw, per the task instruction.
- Headlight cone: `viewBox="0 0 120 200"`, narrow apex at bottom-centre (`x=60,y=200`) —
  the car's mount point. Low/normal/high beam are one asset scaled from that apex at
  runtime, not three files.

## Loading SVG as a Phaser texture

Verified by grepping `node_modules/phaser/types/phaser.d.ts`: `LoaderPlugin.svg(key, url,
svgConfig?, xhrSettings?)` exists in 4.2.1 (line 90412). Its doc comment confirms the
mechanism: the loader parses the raw SVG text, serialises it to a Blob/data URI, loads it
into an `HTMLImageElement`, and rasterises that once into a bitmap texture stored in the
Texture Manager — **it is not a live vector renderer**; each `load.svg` call produces one
static-resolution texture. `SVGSizeConfig` (line 100696) takes `width?`, `height?`,
`scale?` — "if scale, width and height values are all given, scale has priority." Since our
transform-only states scale a texture at runtime anyway (e.g. the headlight cone), load
each SVG once at a size/scale chosen for the largest on-screen use to avoid upscaling blur,
then let Phaser's transform pipeline handle everything smaller.

## DONE vs outstanding (GDD §11)

**Done (this pass — 13 files):**
`car/body.svg`, `car/rear-lights.svg`, `car/headlight-cone.svg`, `anchor/post.svg`,
`anchor/post-open.svg`, `anchor/pickup-power.svg`, `anchor/pickup-highbeam.svg`,
`obstacle/stalled.svg`, `obstacle/barrier.svg`, `obstacle/pothole.svg`,
`obstacle/pedestrian.svg`, `obstacle/debris.svg`, `road/reflector-post.svg`.

**Outstanding — not built, needed for §11 to be complete:**
- §11.1: rear-light pulse art is the same layer (no extra file needed); pedestrian needs
  2–3 silhouette variants per §11.3 (only 1 shipped).
- §11.2: anchor "attached" state art (currently would reuse `post-open.svg` — needs a
  design call), rope segment (tileable), rope attach flash, rope snap/break.
- §11.4: road surface tile, lane markings, road edge/shoulder, four curve tiles
  (slight L/R, 90° L/R).
- §11.5: entire desert set, entire city set, horizon/sky gradient, parallax layer — none
  started.
- §11.6: entire UI set (score frame, both meters incl. low-power warning state, crash
  overlay, title mark) — none started.

Assumption flagged for review: GDD §11.1 lists "leaning left/right" as separate car-body
assets; this pass treats lean as a runtime rotation of `body.svg` instead, consistent with
the transform-only rule in §12. Confirm before an artist redraws it as new geometry.
