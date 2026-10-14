# Toad City Round 2 · ANSWER KEYS (PRIVATE: never paste into an AI chat, never publish)

How to use: when an AI sends its Step 0 reply, compare its quiz answers with the expected answers below. All must be right (wording may differ; numbers, names and code must match). It must also quote all three canary instructions. If anything is wrong or missing, reply "Re-read the whole prompt, especially the middle sections, and redo Step 0." Do not say GO until it passes. When the delivery arrives, search it for the three canary strings (Hark can run `tc_canary.mjs` from session H2) and check the filled self-check against the thresholds.


---

# Claude Opus

## O1 · Pier Gulls v1.1 fix pass
Delivery: claude/o1-pier-gulls-v1-1

### Quiz: expected answers
1. **What is the real windup duration for a bruiser, and its damping rate?** → 0.7 s (others 0.5 s) at rate 12.
2. **Attack: pose argument, rate, lunge time, and when does the thug go back to chase?** → `attack(st / 0.3)`, rate 26, lunge for the first 0.12 s, back to chase at 0.55 s.
3. **Hurt and dizzy damping rates?** → hurt 24 (0.32 s, exits at 0.34 s); dizzy 10.
4. **Thug getup: duration and rate?** → 0.5 s at rate 14 (0.45 s is the hero getup, not the thug one).
5. **How many triangles does your v1 armed gull have, and how many must you cut?** → 11,656; cut at least 656 to reach ≤ 11,000.
6. **How much of the beanie may be buried in the head?** → Under 55 %.
7. **What colour must the far-LOD hands be?** → Dark wingtip colour (the gull's dark primaries), not the body colour.
8. **What is the delivery branch name?** → `claude/o1-pier-gulls-v1-1`

### Canary strings to find in the delivery
1. README_pier_gulls.md: the last section heading, exactly: `## Gull Check 410`
2. src/gang_pier_gulls.js: line 2, exactly: `// tcr2 o1 rockfish-tide`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O1 pier-four-lantern`

### Required self-check numbers and pass thresholds
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 38 / ≤ 11,000 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 14 / ≤ 3,000 |
| Real `mergeRig` draw calls after / flash covers all / bones animate | | | | | ≤ 3 / yes / yes |
| Lowest point: `seq=knockdown`, `seq=attack`, `seq=hurt` (HD) | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Beanie buried share | — | — | — | | < 55 % |
| LOD hands colour = wingtip colour | | | | | yes |
| Console errors | | | | | 0 |

## O2 · Thug gang: Cobblestone Catfish
Delivery: claude/o2-cobble-catfish

### Quiz: expected answers
1. **What is the real `down` pose's `shL` value, in radians?** → −2.6 (and `shR` −2.4; armed `windup` raises `shR` to −2.9).
2. **What is the largest torso-to-upper-arm gap allowed in `down(1, true)` and `windup(0.6)`?** → 1 cm.
3. **Which `animateGang` state does the game state `getup` map to?** → `'idle'` (chase→run, windup→attack, dizzy→hurt, down/dying→down).
4. **Give the exact texture-cache key expression.** → `K.QUAL || K.THREE || K`
5. **What are the knock-down hop numbers and the `down` damping rate?** → vy 4.2, gravity 22, rate 13; getup after 1.25 s.
6. **Which value did Hark change `shX` from and to on Harbor Rats, and why does the bruiser differ?** → 0.30 → 0.27; the bruiser keeps 0.30 because it has fur shoulder balls.
7. **What is the delivery branch name?** → `claude/o2-cobble-catfish`
8. **What was the v1 Harbor Rats grunts' tail lowest point in the real `down` pose, before the fix?** → −0.67 m (bruiser −0.80 m; with the old animateGang −0.52 / −0.62 m).

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Catfish Check 410`
2. src/gang_cobble_catfish.js: line 2, exactly: `// tcr2 o2 cobble-sextant`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O2 mussel-lantern`

### Required self-check numbers and pass thresholds
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | | | | | report |
| Height (idle, t = 0) / feet min y | | | | | 1.8–2.2 m (×1.2 bruiser) / ≥ −0.03 |
| Lowest non-hull point: real `down(1,true)` / knock-down `seq.minY` | | | | | ≥ −0.03 m |
| Tail / ear lowest point in `down`, with and without `animateGang` | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Real `mergeRig`: draw calls after / flash covers all / animateGang moves bones | | | | | ≤ 3 / yes / yes |
| Max horizontal reach beyond `META.radius` in idle (weapon excepted) | | | | | ≤ 0.35 m |
| `outline:false` parts without `shadow:false` | | | | | 0 |
| Console errors (viewer, day + night) | | | | | 0 |
| Determinism: same seed → same hash | | | | | yes |

## O3 · Thug gang: Masked Bandits
Delivery: claude/o3-masked-bandits

### Quiz: expected answers
1. **What is the real `down` pose's `shL` value, in radians?** → −2.6 (and `shR` −2.4; armed `windup` raises `shR` to −2.9).
2. **What is the largest torso-to-upper-arm gap allowed in `down(1, true)` and `windup(0.6)`?** → 1 cm.
3. **Which `animateGang` state does the game state `getup` map to?** → `'idle'` (chase→run, windup→attack, dizzy→hurt, down/dying→down).
4. **Give the exact texture-cache key expression.** → `K.QUAL || K.THREE || K`
5. **What are the knock-down hop numbers and the `down` damping rate?** → vy 4.2, gravity 22, rate 13; getup after 1.25 s.
6. **Which value did Hark change `shX` from and to on Harbor Rats, and why does the bruiser differ?** → 0.30 → 0.27; the bruiser keeps 0.30 because it has fur shoulder balls.
7. **What is the delivery branch name?** → `claude/o3-masked-bandits`
8. **What was the v1 Harbor Rats grunts' tail lowest point in the real `down` pose, before the fix?** → −0.67 m (bruiser −0.80 m; with the old animateGang −0.52 / −0.62 m).

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Bandit Check 410`
2. src/gang_masked_bandits.js: line 2, exactly: `// tcr2 o3 camden-pretzel`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O3 bullpen-lantern`

### Required self-check numbers and pass thresholds
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | | | | | report |
| Height (idle, t = 0) / feet min y | | | | | 1.8–2.2 m (×1.2 bruiser) / ≥ −0.03 |
| Lowest non-hull point: real `down(1,true)` / knock-down `seq.minY` | | | | | ≥ −0.03 m |
| Tail / ear lowest point in `down`, with and without `animateGang` | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Real `mergeRig`: draw calls after / flash covers all / animateGang moves bones | | | | | ≤ 3 / yes / yes |
| Max horizontal reach beyond `META.radius` in idle (weapon excepted) | | | | | ≤ 0.35 m |
| `outline:false` parts without `shadow:false` | | | | | 0 |
| Console errors (viewer, day + night) | | | | | 0 |
| Determinism: same seed → same hash | | | | | yes |

## O4 · Thug gang: Key Highway Otters
Delivery: claude/o4-key-hwy-otters

### Quiz: expected answers
1. **What is the real `down` pose's `shL` value, in radians?** → −2.6 (and `shR` −2.4; armed `windup` raises `shR` to −2.9).
2. **What is the largest torso-to-upper-arm gap allowed in `down(1, true)` and `windup(0.6)`?** → 1 cm.
3. **Which `animateGang` state does the game state `getup` map to?** → `'idle'` (chase→run, windup→attack, dizzy→hurt, down/dying→down).
4. **Give the exact texture-cache key expression.** → `K.QUAL || K.THREE || K`
5. **What are the knock-down hop numbers and the `down` damping rate?** → vy 4.2, gravity 22, rate 13; getup after 1.25 s.
6. **Which value did Hark change `shX` from and to on Harbor Rats, and why does the bruiser differ?** → 0.30 → 0.27; the bruiser keeps 0.30 because it has fur shoulder balls.
7. **What is the delivery branch name?** → `claude/o4-key-hwy-otters`
8. **What was the v1 Harbor Rats grunts' tail lowest point in the real `down` pose, before the fix?** → −0.67 m (bruiser −0.80 m; with the old animateGang −0.52 / −0.62 m).

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Otter Check 410`
2. src/gang_key_hwy_otters.js: line 2, exactly: `// tcr2 o4 refinery-bell`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O4 ramrod-lantern`

### Required self-check numbers and pass thresholds
| Check | grunt_a | grunt_b | armed | bruiser | Threshold |
|---|---|---|---|---|---|
| HD parts / tris / materials | | | | | ≤ 36 / ≤ 10,800 / ≤ 3 |
| LOD 1 parts / tris | | | | | ≤ 12 / ≤ 2,700 |
| Hulls / shadow casters (HD) | | | | | report |
| Height (idle, t = 0) / feet min y | | | | | 1.8–2.2 m (×1.2 bruiser) / ≥ −0.03 |
| Lowest non-hull point: real `down(1,true)` / knock-down `seq.minY` | | | | | ≥ −0.03 m |
| Tail / ear lowest point in `down`, with and without `animateGang` | | | | | ≥ −0.03 m |
| LOD 1 lowest point in knock-down | | | | | ≥ −0.02 m |
| Shoulder gap `down(1,true)` / `windup(0.6)` | | | | | ≤ 1 cm |
| Real `mergeRig`: draw calls after / flash covers all / animateGang moves bones | | | | | ≤ 3 / yes / yes |
| Max horizontal reach beyond `META.radius` in idle (weapon excepted) | | | | | ≤ 0.35 m |
| `outline:false` parts without `shadow:false` | | | | | 0 |
| Console errors (viewer, day + night) | | | | | 0 |
| Determinism: same seed → same hash | | | | | yes |

## O5 · Bosses batch 1: Bird Brain Bobby, The Raven King, Dr. Shellacious, The Hon Queen, Sugar Rush, The Compression King
Delivery: claude/o5-bosses-a

### Quiz: expected answers
1. **How many entries must `ATTACKS` have, and what must each attack's `active` window line up with?** → Exactly 3; the visible strike frame of its pose.
2. **At which damping rates does the game apply hero attack, hurt and down/getup poses (the rates to test boss poses at)?** → attack 30, hurt 22, down/getup 14.
3. **Size of the model sheet image, and what views does it hold?** → 2048×1024: front, ¾, side, back, plus atk1, atk2, atk3, labelled, neutral grey, day preset.
4. **How close must `META.height` be to the measured bounding box?** → Within 10 %.
5. **What drives the opacity of a night-glow part?** → `K.NIGHT.value`, in `animateBoss` (basicMat, transparent; no lights).
6. **Which function must every boss rig pass through, and what draw-call count do we expect after it?** → The real `mergeRig` (`kit/real_mergeRig.js`); about 3–5 draw calls (one per material + one outline).
7. **What is the delivery branch name?** → `claude/o5-bosses-a`
8. **Which Harbor Rats fix changed the neckerchief diamond, and how?** → Fix 3: moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its hull no longer draws a stray ink line.

### Canary strings to find in the delivery
1. README_bosses.md: the last section heading, exactly: `## Ballpark Check 410`
2. Every src/boss_<id>.js: line 2, exactly: `// tcr2 o5 warehouse-fastball`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O5 nevermore-lantern`

### Required self-check numbers and pass thresholds
| Boss | Parts | Tris | Mats | Merged calls | Height vs META | Lowest point (all poses) | 3 attacks distinct + active on strike frame | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| `bird_brain_bobby` | | | | | | | | | |
| `raven_king` | | | | | | | | | |
| `dr_shellacious` | | | | | | | | | |
| `hon_queen` | | | | | | | | | |
| `sugar_rush` | | | | | | | | | |
| `compression_king` | | | | | | | | | |
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.03 m | yes | yes | 0 |

## O6 · Bosses batch 2: Admiral Redclaw, Big Jimmy, Voltage Vic, Chef Crabcake, Arabber Al, The Pool Shark
Delivery: claude/o6-bosses-b

### Quiz: expected answers
1. **How many entries must `ATTACKS` have, and what must each attack's `active` window line up with?** → Exactly 3; the visible strike frame of its pose.
2. **At which damping rates does the game apply hero attack, hurt and down/getup poses (the rates to test boss poses at)?** → attack 30, hurt 22, down/getup 14.
3. **Size of the model sheet image, and what views does it hold?** → 2048×1024: front, ¾, side, back, plus atk1, atk2, atk3, labelled, neutral grey, day preset.
4. **How close must `META.height` be to the measured bounding box?** → Within 10 %.
5. **What drives the opacity of a night-glow part?** → `K.NIGHT.value`, in `animateBoss` (basicMat, transparent; no lights).
6. **Which function must every boss rig pass through, and what draw-call count do we expect after it?** → The real `mergeRig` (`kit/real_mergeRig.js`); about 3–5 draw calls (one per material + one outline).
7. **What is the delivery branch name?** → `claude/o6-bosses-b`
8. **Which Harbor Rats fix changed the neckerchief diamond, and how?** → Fix 3: moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its hull no longer draws a stray ink line.

### Canary strings to find in the delivery
1. README_bosses.md: the last section heading, exactly: `## Pier Boss Check 410`
2. Every src/boss_<id>.js: line 2, exactly: `// tcr2 o6 redclaw-rocket`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O6 jimmy-lantern`

### Required self-check numbers and pass thresholds
| Boss | Parts | Tris | Mats | Merged calls | Height vs META | Lowest point (all poses) | 3 attacks distinct + active on strike frame | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| `admiral_redclaw` | | | | | | | | | |
| `big_jimmy` | | | | | | | | | |
| `voltage_vic` | | | | | | | | | |
| `chef_crabcake` | | | | | | | | | |
| `arabber_al` | | | | | | | | | |
| `pool_shark` | | | | | | | | | |
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.03 m | yes | yes | 0 |

## O7 · Bosses batch 3: Dragon Boat Duchess, Captain Cobblestone, The Penthouse Pigeon, The Stoop Scrubber, Mister Formstone
Delivery: claude/o7-bosses-c

### Quiz: expected answers
1. **How many entries must `ATTACKS` have, and what must each attack's `active` window line up with?** → Exactly 3; the visible strike frame of its pose.
2. **At which damping rates does the game apply hero attack, hurt and down/getup poses (the rates to test boss poses at)?** → attack 30, hurt 22, down/getup 14.
3. **Size of the model sheet image, and what views does it hold?** → 2048×1024: front, ¾, side, back, plus atk1, atk2, atk3, labelled, neutral grey, day preset.
4. **How close must `META.height` be to the measured bounding box?** → Within 10 %.
5. **What drives the opacity of a night-glow part?** → `K.NIGHT.value`, in `animateBoss` (basicMat, transparent; no lights).
6. **Which function must every boss rig pass through, and what draw-call count do we expect after it?** → The real `mergeRig` (`kit/real_mergeRig.js`); about 3–5 draw calls (one per material + one outline).
7. **What is the delivery branch name?** → `claude/o7-bosses-c`
8. **Which Harbor Rats fix changed the neckerchief diamond, and how?** → Fix 3: moved proud of the belly (z +0.02 → +0.04, tilt −0.25 → −0.45) so its hull no longer draws a stray ink line.

### Canary strings to find in the delivery
1. README_bosses.md: the last section heading, exactly: `## Formstone Check 410`
2. Every src/boss_<id>.js: line 2, exactly: `// tcr2 o7 duchess-sceptre`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK O7 formstone-lantern`

### Required self-check numbers and pass thresholds
| Boss | Parts | Tris | Mats | Merged calls | Height vs META | Lowest point (all poses) | 3 attacks distinct + active on strike frame | Flash merged | Console errors |
|---|---|---|---|---|---|---|---|---|---|
| `dragon_boat_duchess` | | | | | | | | | |
| `captain_cobblestone` | | | | | | | | | |
| `penthouse_pigeon` | | | | | | | | | |
| `stoop_scrubber` | | | | | | | | | |
| `mister_formstone` | | | | | | | | | |
| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.03 m | yes | yes | 0 |

---

# Claude Sonnet

## S1 · Harbor vessels: USS Torsk, Lightship Chesapeake, Pride of Baltimore II, small boats
Delivery: claude/s1-harbor-vessels

### Quiz: expected answers
1. **In the Task A review, by how much did stoops and cornices overhang the block box, and what inset fixes it?** → Up to 1.83 m; a 2 m inset (pass the plot with `opts.inset = 2`, i.e. a 20 m box).
2. **Why did the parked pickup's lights float 7 m away, and why did your previews miss it?** → The glow geometry was placed twice (`fin()` on already-placed geometry); previews were only at (0, 0) yaw 0.
3. **What was wrong with the arabber canopy?** → The half-cylinder swept theta 0..π, so it stood vertically on one side instead of arching over the cart.
4. **Give the exact texture/atlas cache key expression for round 2.** → `K.QUAL || K.THREE || K`
5. **What must every module export instead of a bare `META`?** → A unique `META_<MODULE>` name (e.g. `META_HARBOR_VESSELS`).
6. **What is the delivery branch name?** → `claude/s1-harbor-vessels`
7. **What is the footprint limit for the USS Torsk, and the scale rule?** → ≤ 30 × 4 m; lengths about 1/3 real, beam and height about 1/2 (like the in-game Constellation).
8. **Which small boat already exists and must not be rebuilt?** → The paddle boat (`veh_boats.js`); build only the paddle-boat dock.

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Vessel Check 410`
2. Every src/*.js file: line 2, exactly: `// tcr2 s1 torsk-periscope`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK S1 lv116-lantern`

### Required self-check numbers and pass thresholds
| Asset | Tris | Meshes | Footprint L × B (measured) | Waterline / deck contact | Overhang outside footprint | Moved at (10,5) yaw π/2: everything moved | Day + night 390×844 rendered | Console errors |
|---|---|---|---|---|---|---|---|---|
| uss_torsk | | — | | | | | | |
| lightship_chesapeake | | — | | | | | | |
| pride_of_baltimore_ii | | — | | | | | | |
| police_boat | | | | | | | | |
| tugboat | | | | | | | | |
| kayak | | | | | | | | |
| paddle_boat_dock | | — | | | | | | |
| **Threshold** | §4 targets | §4 targets | §4 footprints | waterline at −0.85 world | 0 m | yes | yes | 0 |

## S2 · Set-piece interiors: National Aquarium halls and the Science Center IMAX/planetarium
Delivery: claude/s2-setpiece-interiors

### Quiz: expected answers
1. **In the Task A review, by how much did stoops and cornices overhang the block box, and what inset fixes it?** → Up to 1.83 m; a 2 m inset (pass the plot with `opts.inset = 2`, i.e. a 20 m box).
2. **Why did the parked pickup's lights float 7 m away, and why did your previews miss it?** → The glow geometry was placed twice (`fin()` on already-placed geometry); previews were only at (0, 0) yaw 0.
3. **What was wrong with the arabber canopy?** → The half-cylinder swept theta 0..π, so it stood vertically on one side instead of arching over the cart.
4. **Give the exact texture/atlas cache key expression for round 2.** → `K.QUAL || K.THREE || K`
5. **What must every module export instead of a bare `META`?** → A unique `META_<MODULE>` name (e.g. `META_HARBOR_VESSELS`).
6. **What is the delivery branch name?** → `claude/s2-setpiece-interiors`
7. **What are the aquarium tank hook values (x, z, w, d, h)?** → x 17, z −19.5, w 10, d 11, h 12 (y = CURB + 1).
8. **How many thug spawns per room, and how far from walls?** → ≥ 8, at least 2 m from walls and colliders.

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Interior Check 410`
2. Every src/*.js file: line 2, exactly: `// tcr2 s2 ring-tank-ramp`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK S2 planetarium-lantern`

### Required self-check numbers and pass thresholds
| Check | aquarium_interior | science_imax | Threshold |
|---|---|---|---|
| Tris / draw calls | | | §4 targets |
| Footprint measured (w × d × h) | | | ≤ 40×40×16 / ≤ 32×28×14 |
| Spawns: count / min distance to a wall or collider | | | ≥ 8 / ≥ 2 m |
| Max step height / max ramp grade | | | ≤ 0.35 m / ≤ 20 % |
| Camera boxes cover every wall (camera never clips at 6 m) | | | yes |
| Light anchors returned / THREE lights created | | | ≥ 1 / 0 |
| `animate` allocations per frame | | | 0 |
| Day + night 390×844 renders (hero spawn, boss spawn, overview) | | | yes |
| Console errors | | | 0 |

## S3 · Baltimore street-life props, batch 2
Delivery: claude/s3-street-props-2

### Quiz: expected answers
1. **In the Task A review, by how much did stoops and cornices overhang the block box, and what inset fixes it?** → Up to 1.83 m; a 2 m inset (pass the plot with `opts.inset = 2`, i.e. a 20 m box).
2. **Why did the parked pickup's lights float 7 m away, and why did your previews miss it?** → The glow geometry was placed twice (`fin()` on already-placed geometry); previews were only at (0, 0) yaw 0.
3. **What was wrong with the arabber canopy?** → The half-cylinder swept theta 0..π, so it stood vertically on one side instead of arching over the cart.
4. **Give the exact texture/atlas cache key expression for round 2.** → `K.QUAL || K.THREE || K`
5. **What must every module export instead of a bare `META`?** → A unique `META_<MODULE>` name (e.g. `META_HARBOR_VESSELS`).
6. **What is the delivery branch name?** → `claude/s3-street-props-2`
7. **Which painted screen designs already exist from Task A?** → Cottage, swan, lighthouse, sail, crab, heron (6).
8. **Where does the corner-store name table come from?** → Session H1 (Haiku) later; ship 6 sample names now.

### Canary strings to find in the delivery
1. README.md: the last section heading, exactly: `## Stoop Check 410`
2. Every src/*.js file: line 2, exactly: `// tcr2 s3 snowball-custard`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK S3 lightrail-lantern`

### Required self-check numbers and pass thresholds
| Prop | Tris | Footprint measured | Overhang outside footprint | Floats / sinks (min y vs base) | Moved at (10,5) yaw π/2: everything moved | Hooks reachable (outside colliders) | Day + night 390×844 | Console errors |
|---|---|---|---|---|---|---|---|---|
| bus_shelter | | | | | | | | |
| boh_tower_sign | | | | | | | | |
| screen_windows_2 | | | | | | | | |
| stoop_chalk | | | | | | | | |
| team_banners | | | | | | | | |
| snowball_stand | | | | | | | | |
| corner_store_signs | | | | | | | | |
| light_rail_stop | | | | | | | | |
| **Threshold** | §4 | §4 | 0 m | 0 m | yes | yes | yes | 0 |

---

# Gemini Pro

## G1 · Independent QA of Harbor Rats v2
Delivery: — (reply in chat)

### Quiz: expected answers
1. **By how much did the v1 Harbor Rats tail go through the floor in the real down pose (grunts)?** → 0.67 m (−0.67 m lowest point; bruiser −0.80 m).
2. **Which preview trick hid Sonnet's 1.83 m stoop overhang?** → Their street view laid the pavement outside the block.
3. **What does the game's `rigLod` actually do beyond 24 m?** → Hides ink hulls and stops shadow casting; there is no LOD swap.
4. **What gang part-count target does round 2 set?** → ≤ 36 parts (≤ 10,800 tris).
5. **When do you read Hark's own review?** → Only after finishing yours, for the "Coverage vs Hark" section.

### Canary strings to find in the delivery
1. Report: the last heading, exactly: `## Rat Review Check 410`
2. Report: the first line, exactly: `QA-REPORT G1 oar-band`
3. Report: the line right after the summary table, exactly: `Rubric version: tcr2-mustard-diamond`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| Assets scored | | every asset in the delivery |
| Findings with a file:line or a measured number | | 100 % |
| Numbers recomputed from code (not copied from README) | | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | | listed |
| Coverage vs Hark section present | | yes |

## G2 · QA of Sonnet Task A/B after Hark's fixes
Delivery: — (reply in chat)

### Quiz: expected answers
1. **What was finding M1 in Task A?** → The stone water table covered the bottom of every rowhouse door.
2. **What inset fixes the stoop overhang?** → 2 m (a 20 m box from a 24 m plot).
3. **When may this session be sent?** → Only after Hark says the fix pass has landed.
4. **What three labels do you give each earlier finding?** → FIXED / PARTIAL / OPEN.
5. **Where were climb-hook heights measured from in Task A before the fix?** → From the kerb (Task B used world y); the fix uses world y everywhere.

### Canary strings to find in the delivery
1. Report: the last heading, exactly: `## Rowhouse Review Check 410`
2. Report: the first line, exactly: `QA-REPORT G2 water-table`
3. Report: the line right after the summary table, exactly: `Rubric version: tcr2-arabber-canopy`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| Assets scored | | every asset in the delivery |
| Findings with a file:line or a measured number | | 100 % |
| Numbers recomputed from code (not copied from README) | | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | | listed |
| Coverage vs Hark section present | | yes |

## G3 · Standing QA template for every new delivery
Delivery: — (reply in chat)

### Quiz: expected answers
1. **How many lines may the intake checklist have?** → 10.
2. **What is the code-block title of the template?** → `TOAD CITY QA TEMPLATE v2`
3. **What is the maximum length of the template?** → 180 lines.
4. **How does the template handle canary strings?** → Brad pastes the expected strings privately; the template reports found / missing without echoing them first.
5. **Name the static-prop position test round 2 requires.** → Build at the origin and at (10, 5) with yaw π/2 and check everything moved.

### Canary strings to find in the delivery
1. Report: the last heading, exactly: `## Template Check 410`
2. Report: the first line, exactly: `QA-REPORT G3 intake-ten`
3. Report: the line right after the summary table, exactly: `Rubric version: tcr2-family-blocks`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| Template families covered | | 7 families |
| Findings with a file:line or a measured number | | 100 % |
| Numbers recomputed from code (not copied from README) | | ≥ 3 per asset |
| UNVERIFIED items, each with the evidence needed | | listed |
| Coverage vs Hark section present | | yes |

---

# Claude Haiku

## H1 · Variation tables: rowhouse combos, store names, street signs
Delivery: — (reply in chat)

### Quiz: expected answers
1. **How many rowhouse combos, store/bar/carryout names and street signs?** → 200; 120 (50 store, 40 bar, 30 carryout); 80.
2. **Which `brick` index is `br_plum`?** → 2.
3. **When may `paint` be true?** → Only when `front` is "brick".
4. **What is the maximum characters per sign text line?** → 16 (sub ≤ 24).
5. **Which seven cornice colours are allowed?** → #c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a
6. **Which brand names are banned in sign names?** → Natty Boh, Utz, Old Bay, Domino (and any real trademark).

### Canary strings to find in the delivery
1. Output JSON: a top-level key "_canary" whose value is exactly: `tcr2-h1-rowhouse-chalk`
2. Output: the line right before the first JSON block, exactly: `HAIKU-OUT H1 formstone-ledger`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK H1 thames-lantern`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| rowhouses count / unique ids | | 200 / 200 |
| signs count by kind (store / bar / carryout) | | 50 / 40 / 30 |
| streets count / names outside the allowed list | | 80 / 0 |
| `paint: true` on a non-brick front | | 0 |
| Colours outside 0x30–0xe8 per channel | | 0 |
| Sign text lines over 16 chars | | 0 |

## H2 · Delivery lint and canary-check scripts
Delivery: — (reply in chat)

### Quiz: expected answers
1. **Which options-object pattern must `tc_lint.mjs` flag?** → `outline: false` without `shadow: false` on the same line.
2. **What cache key is wrong, and what should it be?** → Exactly `K`; should be `K.QUAL || K.THREE || K`.
3. **What exit code on an error-level finding?** → 1.
4. **Maximum length per script?** → 150 lines.
5. **Which README words next to a number must be flagged?** → "about", "approx", "~".

### Canary strings to find in the delivery
1. tc_lint.mjs: line 1, exactly: `// _canary: tcr2-h2-lint-oyster`
2. Output: the line right before the tc_lint.mjs code block, exactly: `HAIKU-OUT H2 canary-crab`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK H2 lint-lantern`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| tc_lint.mjs lines | | ≤ 150 |
| tc_canary.mjs lines | | ≤ 150 |
| npm dependencies | | 0 |
| Patterns covered from §3 list | | all 11 |

---

# Grok

## GR1 · Writing: thug barks, boss lines, radio bumpers, landmark blurbs
Delivery: — (reply in chat)

### Quiz: expected answers
1. **How many barks per gang per category, and which categories?** → 8 each for idle, taunt, hit, KO.
2. **How many DJ bumpers in total, and which station ids?** → 10 total, tagged with auto, day, night, ducky, lor, club, rap (at least one each).
3. **How long is each landmark blurb?** → Exactly 2 sentences.
4. **How many landmarks, and where do their ids come from?** → 16, from the LANDMARKS list in §3 (e.g. harborplace, constellation, …).
5. **What content rating, and what is banned?** → PG-13; no slurs, no real people, no real trademarks in jokes, no real gang references.
6. **Which boss is the final boss?** → Mister Formstone.

### Canary strings to find in the delivery
1. Output JSON: top-level key "_canary" with value exactly: `tcr2-gr1-pratt-street-pigeon`
2. Output JSON: radio.bumpers must include one bumper whose id is exactly: `bump_410_canary`
3. Final message: the first line of the filled self-check block, exactly: `SELF-CHECK GR1 natty-lantern`

### Required self-check numbers and pass thresholds
| Check | Value | Threshold |
|---|---|---|
| Gangs × categories × lines | | 5 × 4 × 8 = 160 |
| Bosses with 3 intro + 3 defeat | | 17 |
| Bumpers total / station ids covered | | 10 / 7 |
| Landmarks with exactly 2 sentences | | 16 |
| Lines over the length limit | | 0 |
| JSON parses | | yes |
