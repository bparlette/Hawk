# Toad City Baltimore — Task D bosses, batch 2 (O6)

Six bosses, one ES module each in `src/`, built on the round-2 ZIP kit (`kit/toadcity_kit.js`, byte-identical) and tested with the
real poses and the real `kit/real_mergeRig.js`. Work in progress: bosses are added one at a time (see the git log).

| Boss | File | Status |
|---|---|---|
| Admiral Redclaw | `src/boss_admiral_redclaw.js` | built, measured, previews |
| Big Jimmy | `src/boss_big_jimmy.js` | built, measured, previews |

## Tools
- `viewer_bosses.html` — the boss viewer (from `kit/real_viewer.html`): `?show=<id>&pose=idle|run|hurt|down|atk1|atk2|atk3|all`, `&turn=1`, `&sheet=1`,
  `&strip=atk1|atk2|atk3|knockdown`, `&seq=…`, `&cam=phone`, `&night=1`, `&merge=1`, `&flash=0.85`, `&angry=1`. Shipped in the zip as `viewer.html`.
- `tools/measure_boss.mjs` — the boss harness (on Hark's `harness/realK.mjs` + `fakedom.mjs`); writes `tools/results_boss_<id>.json`.
- `tools/check_hooks.mjs` — calls the live-mode hooks with the game's partial deps; adds `hooks` to the same JSON.
- `tools/boss_seq.js` — the boss state timings (shared by viewer and harness). `tools/boss_jobs.mjs` + `tools/shoot.mjs` render `previews/`.

## Design notes

### Admiral Redclaw (`admiral_redclaw`, Fort McHenry)
A cooked-orange crab admiral of 1812, broad as a cannon carriage. Silhouette: an oversized black bicorne worn athwart (it is the shape
that reads from the far flagship deck), a wide flat carapace with two side spikes that becomes his shoulders, a crimson tailcoat with
split tails, white breeches and black riding boots, and two very different arms: a giant pincer on the left and a brass rocket-cannon
for a right forearm. Palette: shell orange (steamed red when angry), crimson coat, white facings and cross-belts, gold epaulettes and
cockade, black hat and boots. Attacks: **rocket barrage** (plants, swings the cannon to a firing line, three recoil kicks: a ranged
volley), **claw sweep** (coils the pincer over the shoulder, then a flat 170° sweep that snaps shut), **broadside slam** (hops with the
cannon raised and drives it muzzle-first into the deck: a ground ring). No flag, regiment, insignia or real person.

### Big Jimmy (`big_jimmy`, National Aquarium tank)
A giant Maryland blue crab, a male "jimmy", 3.6 m across the spines. Silhouette: a wide, flat, dusky blue-olive carapace with the long
lateral spines and a row of front teeth, stalk eyes, two big azure claws held up in front of his face with cream fingertips (a male's
claws are blue, no red tips), eight legs (three walking pairs and the flat swimmer paddles at the back) and a white belly with the
male's narrow T-shaped apron. He hovers a hand's width off the tank floor (underwater). Steamed red when angry. Attacks: **pincer
crush** (both claws swing wide open, then clamp together at full reach), **sideways rush** (swings half side-on and charges crabwise,
the leading claw sweeping across), **belly slam** (rears up on the back legs showing the soft belly, claws high, then drops his whole
body flat: a bubble ring). Knock-down: the crab flip, rolled over the tail onto his back with the legs folded up and pedalling.
