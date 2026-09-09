# NIGHT LINE — Game Design Document

Working title. A one-button endless night-driving game, inspired by Atari's Night Driver (1976).

Version 0.1 · Draft for review

## 1. In one line

You drive into the dark at rising speed, and the only thing you can do is throw a rope at a
lit post and swing around whatever is about to kill you.

## 2. Heritage, and what we deliberately change

Night Driver (Atari, arcade, October 1976; Atari 2600, June 1980) is one of the earliest
first-person racing games and is widely credited as the first published game with real-time
first-person graphics. Its road edges were marked by reflective posts, and the player's car
was not drawn at all — it was a printed plastic insert laid under the screen. The night
setting existed largely as an excuse for minimal graphics: street and buildings simply
weren't visible.

Three deliberate departures:

| Original | Night Line | Why |
|---|---|---|
| First-person, car not drawn | Third-person, behind the car | The rope swing is only readable if you can see the car move across lanes |
| Steering wheel, accelerator, gear shift | One button (spacebar) | A single skill, learnable in five seconds, deep through timing |
| Darkness as a technical excuse | Darkness as the core resource | The headlight meter turns the original's limitation into the difficulty system |

One inheritance we keep on purpose: the reflector posts become the rope anchors. The thing
that merely decorated the original road is now the thing you survive by.

## 3. Core loop

- The car drives forward automatically, gaining speed.
- A hazard resolves out of the dark ahead — an obstacle in a lane, or a curve.
- A lit anchor post appears on the safe side.
- Press and hold space: the rope throws, attaches to the nearest anchor, and the car is
  pulled into that lane.
- Hold while the hazard passes. Release: the rope detaches and the car returns to centre lane.
- Survive. Score is time survived. Repeat, faster, darker.

Session ends on a single collision. Restart is immediate, from the beginning.

## 4. The verb — rope mechanics in detail

One button, three distinct skills. This is the whole game and must be tuned above everything
else.

### 4.1 Input states

| Input | Result |
|---|---|
| Press space, anchor in range | Rope throws, auto-attaches to nearest anchor, car begins pulling toward that lane |
| Hold space | Car stays in the anchor's lane |
| Release space | Rope detaches, car eases back to centre lane |
| Press space, no anchor in range | Rope throws and finds nothing — a miss, brief cooldown before it can be thrown again |

### 4.2 The three timing skills

**Skill 1 — When to press.** Each anchor has a throw window: it opens when the anchor enters
rope range and closes shortly before the hazard arrives. Press before the window opens and
the rope finds nothing, and the cooldown may leave you unable to throw again in time. Press
after it closes and you hit the hazard.

**Skill 2 — How long to hold.** Release early and the car returns to centre while the hazard
is still alongside — a collision. The hold must outlast the hazard.

**Skill 3 — When to let go.** The rope has a maximum extent. Hold past the point where the
anchor falls behind the car and the rope reaches its boundary and snaps — also a collision.
This is the failure the player will discover last and respect most.

So: press in a window, hold long enough, release before the boundary. Three failure modes
from one key.

### 4.3 Hard authoring rules

These are not tuning values; breaking them makes the game unfair.

1. Every hazard has at least one anchor placed so that roping to it is survivable. No hazard
   is unavoidable.
2. Anchors only ever spawn on the safe side. An anchor that pulls the car into an obstacle
   must never be generated.
3. The anchor is visible before the hazard is actionable. The anchor is the player's warning
   system; if the hazard resolves out of the dark first, the player has been cheated.
4. Reaction window has a floor. However fast the car is going, the throw window must never be
   shorter than a fixed minimum in real time. At maximum speed this means anchors spawn
   further out, not sooner in.
5. Never two hazards requiring opposite swings within one rope cycle. The car must be able to
   return to centre between them.

### 4.4 Anchor visibility

The anchor is the most important object on screen and must be the brightest thing in the frame
after the headlight cone: tall, vertical, self-lit, with a pulse that starts the moment the
throw window opens and stops when it closes. The pulse is the tutorial — no text needed.
Under zero headlight power the anchor stays visible when almost nothing else does.

## 5. Road and lanes

- Three lanes. The car rests in the centre lane. Roping moves it to the left or right lane. It
  never occupies a position between lanes except in transit.
- Road surface is simple and readable; the lane the car is in must be legible at a glance even
  at low visibility.
- Roadside alternates randomly between environment sets — desert/sand, and city buildings —
  with more sets addable later. Roadside is decoration and a progress cue; it never affects
  collision.
- Roadside also carries the retro reflector-post lineage: unlit posts stream past as scenery,
  so lit anchors read as "one of these, but special."

## 6. Hazards

### 6.1 Obstacles

Occupy one or two of the three lanes, never all three. Randomised, no repeating pattern.
Initial catalogue:

| Obstacle | Lanes | Notes |
|---|---|---|
| Stalled vehicle | 1 | The baseline hazard |
| Road works / barrier | 1–2 | Wider, forces a specific lane |
| Pothole or broken surface | 1 | Low-profile; hardest to see in the dark |
| Pedestrian crossing | 1–2 | Figures crossing the road; adds motion and drama |
| Debris / fallen object | 1 | Small, fast to resolve |

### 6.2 Curves

Curves are hazards, not scenery — the rope is how you take a corner.

| Curve | Behaviour |
|---|---|
| Slight left / slight right | Gentle; a short hold |
| 90° left / 90° right | Sharp; a long hold, and the rope boundary becomes a real threat |

No 180° switchbacks. Curve direction and severity are randomised.

### 6.3 Combinations

At higher difficulty, obstacles may appear inside curves — but only where rule 4.3.5 still
holds. The player must always be able to complete one rope cycle before the next demand.

## 7. Speed and progression

- Speed increases gradually and continuously, never in steps.
- Cap: 3× the starting speed, reached at roughly 5–6 minutes.
- After the cap, speed holds constant permanently.
- Beyond the cap, difficulty continues to rise through hazard density and variety, not speed —
  more frequent hazards, more obstacle-in-curve combinations, tighter (but never sub-minimum)
  windows.
- Endless. There is no ending and no level structure in this version.

## 8. The two meters

Two separate resources, two separate pickups, two separate art sets.

### 8.1 Headlight power — the visibility meter

- Governs how far ahead the world is lit.
- Drains continuously with time and distance.
- At full: the player sees far, hazards resolve early, and the game feels fast but fair.
- As it falls: the lit cone shortens, hazards resolve later, reaction windows compress toward
  their floor.
- At zero: visibility is very low but never zero. Obstacles and anchors remain visible — just
  barely, and late. Hard, not blind.

### 8.2 High beam — the burst resource

- A separate meter with its own pickup.
- On collection, the high beam activates automatically and lights much further ahead.
- While active, it drains its own meter only. It does not consume headlight power.
- On empty, the high beam switches off automatically and the player returns to whatever
  headlight power remains.

### 8.3 Pickups are anchors

Since space is the only input, pickups cannot be steered into. A pickup is an anchor you can
rope to — roping it both swings the car and collects it. This means the player is constantly
choosing between the anchor that is safest and the anchor that is useful.

That choice is the strategic layer of the game, and it costs no extra buttons.

### 8.4 The design consequence to protect

Because visibility controls how early hazards resolve, the power meter is simultaneously the
atmosphere system and the difficulty system. This is the best property of the design and the
easiest to break. Protect it with the reaction window floor (4.3.4): low power must make the
game later and tenser, never impossible.

## 9. Scoring

- 1 point per second survived. Nothing else scores.
- No combo, no bonus for stylish swings. Survival is the only currency, which keeps the game
  honest and the HUD quiet.
- Best score persists for the session and is the thing players chase.

## 10. Failure

A single collision ends the run. Collision cases:

- Hitting an obstacle (rope thrown too late, released too early, or not thrown)
- Rope boundary snap (held too long)
- Leaving the road on a curve (curve not roped)

On failure: brief impact beat, score shown, immediate restart from the beginning. No lives, no
checkpoints, no continues.

## 11. Assets required

All static art as SVG. One file per asset. Colours referenced from a shared token file so the
whole game can be re-themed in one edit.

### 11.1 Car
- Car body, top-down-rear three-quarter view, centre lane (neutral)
- Car body, leaning left (roped left)
- Car body, leaning right (roped right)
- Rear lights (separate layer, so they can pulse independently)
- Headlight cone — three variants: low power, normal, high beam

### 11.2 Rope and anchors
- Anchor post, idle (out of window)
- Anchor post, active (throw window open) — the brightest object in the game
- Anchor post, attached
- Pickup anchor: headlight power variant
- Pickup anchor: high beam variant
- Rope segment (tileable, so length is dynamic)
- Rope attach flash
- Rope snap / break

### 11.3 Obstacles
- Stalled vehicle
- Barrier / road works
- Pothole
- Pedestrian (2–3 silhouette variants)
- Debris

### 11.4 Road
- Road surface tile
- Lane markings
- Road edge / shoulder
- Curve tiles: slight left, slight right, 90° left, 90° right
- Unlit reflector post (scenery)

### 11.5 Roadside environments
- Desert set: dunes, rocks, cacti or scrub, distant mesa silhouette
- City set: building silhouettes (3–4 variants), streetlights, signage
- Horizon / sky gradient
- Distant parallax layer (shared)

### 11.6 UI
- Score display frame
- Headlight power meter (empty, fill, low-warning state)
- High beam meter (empty, fill, active state)
- Crash / game over overlay
- Title screen mark

## 12. Animations required

Delivered as spritesheets — one sheet per object. Uniform frame cells, one row per state, fixed
registration point across all cells so nothing jitters. Each sheet ships with a metadata file
listing frame size, columns, and per-state row / frame count / fps / loop behaviour.

| Object | States |
|---|---|
| Car | idle (centre), pull-left, hold-left, return-from-left, pull-right, hold-right, return-from-right, crash |
| Rope | throw, attach, taut (loop), detach, snap |
| Anchor post | dormant, window-open pulse (loop), attached, passed |
| Power pickup | idle glow (loop), collected |
| High beam pickup | idle glow (loop), collected |
| Pedestrian | walk cycle (loop), react/flinch |
| Headlight cone | low (loop), normal (loop), high beam (loop), transition flicker |
| Power meter | fill states, low-power warning pulse |
| Crash | impact, settle |

Everything animates by transform only — translate, scale, rotate, opacity. No path morphing
between frames. Squash and stretch preserves volume.

## 13. HUD — screen elements

Minimal by design. The dark is the game; the HUD must not light it up.

**Desktop**
- Score: top right
- Headlight power meter: bottom left
- High beam meter: bottom left, directly beneath the power meter

**Mobile**
- Score: top centre
- Both meters: bottom left, stacked as above

Not shown: speedometer, distance, lap, minimap, combo. Speed is felt, not read.

The car occupies the bottom centre of the frame. Nothing else lives in the bottom strip — that
space belongs to the car and the road rushing under it.

## 14. Look and feel

Retro foundation, modern finish. The silhouette language and one-button simplicity are 1976;
the lighting, colour and motion are contemporary.

- Darkness is the canvas. Most of the frame is unlit most of the time.
- Light sources are the palette: headlight cone, anchor glow, rear lights, pickup glow,
  distant city.
- Colour proposal for review: near-black base, warm headlight, cool cyan or white anchors so
  they never read as hazards, saturated warning colour reserved exclusively for obstacles and
  the low-power warning.
- Motion sells speed: road texture streaming, roadside parallax, subtle camera push as speed
  rises, screen shake only on impact.

## 15. Audio direction

- Engine tone that rises with speed — the primary speed cue since there's no speedometer.
- Rope: throw whoosh, attach thunk, taut hum, snap.
- Pickup chime, distinct per meter type.
- Low-power warning: a quiet recurring pulse that gets harder to ignore.
- Crash: single hard impact, then silence before restart.

## 16. Decisions still open

- Multiple anchors on screen at once — confirmed as possible, but how many, and does "nearest"
  pick by distance ahead or by lane proximity?
- Miss cooldown length — long enough to punish panic-pressing, short enough to allow recovery.
- Pickup frequency — how often power and high beam anchors appear, and whether frequency
  scales with difficulty or stays flat.
- Return-to-centre duration — fast return is forgiving, slow return creates the "can I make
  it?" tension. Needs playtesting.
- Do pickups ever appear on the unsafe side, forcing a risk/reward choice? Tempting, but it
  conflicts with authoring rule 4.3.2 unless carefully bounded.

## 17. Out of scope for this version

Steering, braking, acceleration input, lives, checkpoints, levels, boss encounters, traffic AI,
weather, multiple vehicles, upgrades, currency, leaderboards, cutscenes, narrative,
multiplayer.
