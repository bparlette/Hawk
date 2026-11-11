# PITBALL VERITY — the three levels

Data: `levels.js` (schema-checked by `validate-levels.mjs`). This doc is the
human layer: why each pit is shaped the way it is, what the art lane should
draw, and the moment in each level designed to be clipped.

## Shared conventions

- Logical space 540×960, y 0 = top, y 960 = floor. The hero plays along the
  floor and fires orbs UP; orbs fly at constant speed, ricochet, and fall back
  to be caught (catch = instant reload).
- Wall insets: how far each wall face leans into the pit across a y-span
  (linear between `inset0`/`inset1`). Interior width at any height =
  540 − insetL − insetR.
- Base enemy descent speeds (before a level's `speedMul`): walker 56 px/s,
  runner 118, brute 38, splitter 66. A walker therefore crosses the full
  960 px in ~17 s on L1 and ~10.7 s on L3.
- Spawn pressure: base interval 1.1 s × `pressureMul`; every
  `escalateEverySec` the director tightens further. Entries in a spawn table
  switch on at `fromSec` and stay on; `weight` is their relative share.
- ENGINE NOTE — Crown Spire divider fin: the fin is scene prop `divider-fin`.
  Treat it as a solid vertical barrier at x = 270, spanning y 40–320, ~14 px
  thick, with a rounded bottom tip. Orbs and enemies collide with it; enemies
  spawn into one of the two lanes it creates and stay in that lane until it
  ends at y 320.

---

## Level 1 — FROST SHAFT (difficulty 1)

**The angle story.** The pit is a straight 516 px-wide ice corridor — no wall
angles at all, so a new player learns pure vertical ricochet first: orbs go
up, kiss a flat wall, come straight back. The geometry lesson is the two ice
deflector shelves. The upper shelf (centre 150,380, tilted −28°) catches orbs
fired up the left side and banks them hard right across the pit; the lower
shelf (390,600, +28°) banks them back left. Together they make a lazy Z: an
orb fired from the left third can be made to sweep both halves of the pit
without the hero moving. Because the shelves sit at different heights, the
same firing position produces different paths as enemies push the bounce
points around — the level teaches *aiming with angles* while the walls stay
forgiving.

**Scene (art lane).** `frost-cavern` backdrop, palette bg `#0a2a3d`, wall
`#bfe9f5`, glow `#67e8f9`, accent `#e0faff`. A frozen Metroid-style cavern:
pale blue ice walls with visible strata and frost bloom, icicles hanging
from the top frame and from both shelf undersides, drifting frost mist
(`frost-mist`), frozen rubble chunks embedded in the lower walls, and far
below/behind the floor line a soft cyan glow — the core (`glowing-core-below`)
— that pulses gently. Everything bright and clean; this is the friendly
level and should read almost white-blue on a phone screen.

**Difficulty knobs.** Baseline for the game: pressureMul 1.0, escalation
every 30 s, 240 s survive goal. Walkers only for the first 45 s; runners
(0.7× HP, fast) join at 0:45 as a tempo change, not a threat spike; a light
splitter taste (weight 2) at 2:30. Walker descent ~17 s top-to-floor — the
player can ignore a walker for several seconds and still recover.

**The shot.** ~0:50, right after runners unlock: a runner column streams
down the right side while walkers clog the left. The hero stands still,
fires once up the left, and the orb runs the full Z — shelf, shelf — and
deletes the runner column from the side. One shot, no movement, whole
screen cleared diagonally. Title it "she didn't even move."

## Level 2 — THE FOUNDRY BEND (difficulty 2)

**The angle story.** The pit stops being a corridor and becomes a funnel.
It starts a full 540 px wide, then the left wall leans in at ~25° (y
240–480) while the right wall stays straight a beat longer, then leans in at
~25° too (y 360–600) — the stagger makes a zig-zag, not a symmetric cone,
so left-fired and right-fired orbs behave differently. By the floor the pit
is only 300 px wide. Two consequences: (1) orbs fired upward *converge* —
the funnel walls keep banking them toward the centre, so the upper pit gets
crowded with bouncing orbs and enemies descending into them get shredded;
(2) anything that slips through the throat arrives at the floor *fast and
centred*, right on top of the hero. In the throat sits the deflector
diamond (two 110 px deflectors at ∓30° meeting at 270,470): orbs ride its
roof and split left/right, and brutes wedged under it get pinballed between
diamond and funnel wall. A third small deflector at (270,760, −18°) guards
the floor, tipping late orbs sideways instead of letting them drop dead
centre. This level is about *compression*: wide chaos up top, lethal focus
at the bottom.

**Scene (art lane).** `foundry` backdrop, palette bg `#1a0b06`, wall
`#7a3b26`, glow `#ff7a1a`, accent `#ffd23c`. Mega Man industrial fire zone:
dark riveted steel walls with heat-discoloured panels, lava channels
(`lava-channels`) glowing in seams along both outer edges, ember vents
(`ember-vents`) puffing sparks at the two step shelves, slag piles
(`slag-piles`) at the funnel throat. The diamond deflector is a chunk of
machined steel with hazard chevrons. Hot orange rim light on everything;
the orbs' colours pop against the dark red-brown.

**Difficulty knobs vs L1.** Pressure 1.0 → 1.35 and escalation 30 s → 25 s
(effective spawn rate 0.91 → 1.47/s). Brutes enter at 0:20 — early, on
purpose, because the funnel is a brute-killing machine and the level wants
to show that off; brute HP 1.6×. Walkers get 1.3× HP and 1.1× speed.
Splitters at 2:00, and splitter children in a 300 px throat are a real
problem. Goal changes from survive to **220 kills in 300 s** — the funnel
makes kills plentiful, so the level asks you to farm it, not just endure it.

**The shot.** A brute lumbers into the throat and wedges under the diamond
while a splitter pops above it. For about four seconds the brute is caught
in a ricochet loop — diamond, wall, diamond, wall — taking hits faster than
the hero is even firing, kill-chain multiplier ticking up the whole time,
until it bursts. The clip sells itself: "the funnel fights for you."

## Level 3 — THE CROWN SPIRE (difficulty 3)

**The angle story.** A narrow pit — 340 px at the top, 380 at the floor —
split down the middle of its upper third by the divider fin (x 270,
y 40–320). Every orb fired and every enemy spawned commits to a lane. The
hero must choose which lane to feed, knowing the neglected lane is quietly
filling up. At the merge (y ~355) two deflectors angled ∓40° face each
other across the centre line: an orb coming down the left lane hits its
deflector and is thrown *across* into the right lane — the only way to
service both lanes from one position, and it only works on the way through
the merge, so positioning and timing replace the raw coverage the wide
levels gave for free. Below the merge, one long deflector (270,640, +25°)
keeps the lower pit stirred, banking orbs wall-to-wall in the narrow space
where elite brutes are descending. Ricochets here are short, fast and
dense: in a 340 px pit an orb crosses the full width in well under a
second, so the screen fills with crossing lines — controlled chaos, if the
player keeps the lanes balanced.

**Scene (art lane).** `spire` backdrop, palette bg `#12081f`, wall
`#4c2a72`, glow `#a78bfa`, accent `#67e8f9`. Storm-tech spire interior:
dark violet alloy walls with glowing circuitry traces, the divider fin a
blade of black metal edged in electric violet, background lightning arcs
(`lightning-arcs`) crawling between storm coils (`storm-coils`) mounted
behind the pit walls, diagonal rain streaks (`rain-streaks`) sheeting
across the upper lanes. Occasional full-screen arc flashes (background
only, never gameplay-obscuring). The narrowest, darkest, busiest level —
the palette contrast against L1's pale ice is the point.

**Difficulty knobs vs L2.** Pressure 1.35 → 1.8, escalation 25 s → 20 s
(effective 1.47 → 2.45/s). All four enemy types are live by 0:45 — runners
from 0:00 alongside walkers, splitters at 0:30, and brutes at 0:45 with
2.6× HP (elites). Descent is the fastest in the game: walker speedMul 1.6
(~10.7 s top-to-floor), runners 1.5×. The pit is ~35% narrower than L1, so
there is physically less room to dodge a floor breach, and the fin means a
lane left alone for ~10 s is a damage event. Goal back to survive — 330 s
of it. This is the level where level-up picks stop being bonuses and start
being load-bearing.

**The shot.** Both lanes are stacked to the fin, an elite brute is halfway
down the right lane, and the hero fires up the *left* lane: the orb threads
the left column, crosses at the merge deflector, and starts clearing the
right lane from inside — chain multiplier climbing as the brute pops.
Caption writes itself: "wrong lane. didn't matter."

---

## Difficulty ladder at a glance

| Knob | L1 Frost Shaft | L2 Foundry Bend | L3 Crown Spire |
|---|---|---|---|
| Pit width | 516 (straight) | 540 → 300 (funnel) | 340 → 380 (split lanes) |
| pressureMul | 1.0 | 1.35 | 1.8 |
| Escalation | 30 s | 25 s | 20 s |
| Effective spawns | 0.91/s | 1.47/s | 2.45/s |
| Walker crossing | ~17 s | ~15.6 s | ~10.7 s |
| Types live by | 2:30 (3 of 4) | 2:00 (all 4) | 0:45 (all 4) |
| Brute HP mul | — | 1.6× | 2.6× (elite) |
| Goal | survive 240 s | 220 kills / 300 s | survive 330 s |
