# Boss + Gang Upgrade Plan: raise everything to the Chip Kid standard
Read-only audit, 2026-10-12 (about 17:30 ET). Nothing in source was edited, and nothing was deployed.

**Sources read:** DESIGN.md, PROGRESS.md, handoff/PARALLEL_BUILDER.md and memory toad-city-baltimore.md. Code read:
- hark/integration at **0c44dfb** in worktree game-int. This is fb940ee + homepage + Pete. hark/pete is the same commit.
- hark/chipkid-fun **ecc3c2a** (committed version; the working tree is being polished right now by another agent).
- hark/pigeon 48755b6.
- Uncommitted worktrees: game-carl (src/09k_carl.js), game-rodney (src/09m_rodney.js) and game-lexington (03d/09l, which is a landmark with no boss).
- hawk-relay README_harbor_rats / pier_gulls / cobble_catfish / masked_bandits.md, relay/briefs/O8.md, and GR1 data (src/06e_gr1_data.js).

**Caveat:** juice levels come from reading code and grepping for each feature: hitstop, shake, slow-mo, pops, POWER, grade, rematch, i-frames. Nothing was play-tested in this audit, because the CPU was busy with the chipkid-fun tests. Difficulty calls are inferred from the tuning constants.

---
## 0. The Chip Kid standard (the checklist every fight is measured against)
From 09c_chipkid.js + the 09a juice block on ecc3c2a:

| # | Item | Chip Kid reference value |
|---|---|---|
| S1 Difficulty | Easy but not trivial: frequent, loudly telegraphed attacks | Tells 1.0–1.7 s with a "!" over the boss + ground ring / lane flash, half damage, 1.3 s i-frames, Mavis crab cakes when low, one SECOND WIND, full heal between rounds. A **mash-SWING-only bot wins while taking ≥2 hits** (~42 sim-s). |
| S2 Hits | Wind-up, motion trail, hitstop, shake, sparks/debris, damage numbers, flinch + white flash | 65–85 ms hitstop, `D.trail`, `D.debris`, `D.sprites`, `D.pop` (gold crit on an OPEN boss), `D.hitSfx` light/heavy/mega |
| S3 Combo | 3-hit combo + finisher | Forehand → backhand → overhead SMASH, plus a combo counter (`D.combo`) |
| S4 POWER | A meter filled by hits and dodges, flashy animated specials | `D.power` + `D.ready` + pulsing ACT. 3 rotating specials, each with slow-mo, zoom, flash and invulnerability. |
| S5 KO | Cinematic slow-mo KO | The final blow → slow-mo → the boss blows apart → the character exits with a gag |
| S6 Grade | Star grade + REMATCH | Stars by hits taken (≤3 S, ≤8 A, else B), `DUELS.over(...,{again:true})` |
| S7 Fit | Mobile 390x844 | No clipped HUD text (the current polish in the 09a working tree adds 390 px media rules) |

The 09a juice API is opt-in: `D.hitstop/slowmo/shake/zoom/flash/pop/combo/power/ready/impact/hitSfx/trail/debris/sprites`, `over(..,{again})` and the `K.buffer` input hook. **It only reaches modes that run on DUELS:** Jimmy, Chip Kid, Pete, Pigeon, Carl and Rodney. Derby, racers, Vic, Fort and the street brawl each have their own loop and HUD, so they cannot call it today.

For non-brawl genres, "hit" means the mode's core verb: bat contact, a ram, a note hit, a bite, a strike or a goal. "3-hit combo" means a streak chain with a finisher beat.

---
## 1. Every boss / special fight: current state vs the standard
Legend: ✅ meets the standard · ◐ partial · ✗ missing. Columns: Hits = S2+S3, POW = S4, KO = S5, Grd = S6, Dif = S1. "Juice grep" counts hitstop / shake / slow / pops.

| # | Fight | Where (file · branch) | Style | Current attacks | Hits | POW | KO | Grd | Dif | Biggest gaps |
|---|---|---|---|---|---|---|---|---|---|---|
| — | **Street brawl (open-world thugs)** | 06_game.js (hitEnemy, updateEnemy, POSTS), 06b_cine.js (POWER, finisher QTE) · integration | 3D beat-'em-up | All thugs: one windup (0.5 s, bruiser 0.7 s) → lunge swing. Armed = longer reach. Max 2 attackers at once. Grunt 8 HP / bruiser 16 HP. | ◐ 3-hit cane combo + air spin; hitstop 50–90 ms, shake, POW words, slash sprite, white flash, knockback; **no damage numbers, no trail on the cane** | ◐ POWER = **7 s cooldown** cane slam + Mavis handbag join; one special only, not meter-driven | ✅ dizzy QTE finisher with camera cuts + 0.35x slow-mo (best KO in the game) | ✗ no grade or "block cleared" card | ◐ fair but flat: one attack type for every gang | No meter or specials, no numbers, every gang plays the same, no area-clear payoff |
| 1 | Admiral Redclaw · Fort McHenry "Bombardment" | 09_fort.js · integration | First-person gallery | 4 waves: sloop cannonballs, ketch mortars, rocket ship (red trails), flagship + Redclaw | ◐ shake + score pops, **no hitstop** on ship kills | ✗ | ✅ flag raise + anthem + fireworks | ✗ score only, no stars | ? flag HP; not measured | No POWER, no hitstop, no grade/rematch on win |
| 2 | Voltage Vic · Power Plant | 06v_vic_rhythm.js · integration | Rhythm | Note lanes; "drops" telegraphed a bar ahead as red attack bars | ◐ pops + combo multiplier to x1.5, light shake, **no hit flash on Vic, no hitstop** | ✗ | ◐ win banner | ✗ | ◐ HP floor per phase; drop tells are good | No POWER special, no KO cinematic, no grade |
| 3 | Bird Brain Bobby · Oriole Park | 06g_derby.js · integration | Home run derby | Fastball / curve / changeup / knuckle, each with a windup tell + hand glow + ball trail | ◐ ball trail, fireworks, 1 pop, **no contact hitstop** | ✗ | ◐ crowd + fireworks | ✗ | **✗ likely hard**: 10 HR before 10 outs, 0.14 s contact window, timing only on phones | Contact feel, POWER, grade, a softer phone window |
| 4 | Arabber Al · Fells Point | 06h_racers.js · integration | Chase racer | Flings watermelons / cabbages / tomato crates; alleys; water-taxi crossings; 90 s clock, 3 rams | ✅ ram hitstop 0.12 + shake 0.7 | ◐ BOOST only | ◐ | ✗ | ◐ clock pressure | Special, KO cinematic, grade |
| 5 | Dragon Boat Duchess · first boat ride | 06h_racers.js · integration | Boat ramming | Paddle-sceptre swing (raised + glow tell), splash waves (head-rear tell, HOP) | ✅ hitstop 0.08–0.15 + shake | ◐ boost | ◐ | ✗ | ✅ tells exist | Special, KO, grade |
| 6 | Big Jimmy · Aquarium | 09b_jimmy.js · integration (+ belly-hit `DUELS.impact` on chipkid-fun) | 3D swim duel | Claw snap (claw-flash tell), bubble blast (cyan tell, homing in phase 3), rear-up opening | ◐ belly impact only on chipkid-fun; **single STRIKE, no combo** | ✗ | ✗ | ✗ | **✗ likely hardest**: 300 HP, tells 0.8→0.55 s, homing bubbles, air drain to 1/21 s | Every item except tells |
| 7 | **The Chip Kid · Harborplace (REFERENCE)** | 09c_chipkid.js · chipkid-fun ecc3c2a | Punch-Out mech duel | Seasoning cloud, chip-can barrage, bag-slam, claw jab | ✅ | ✅ Old Bay Cyclone / Crab-Mallet Pound / "HON!" Homer | ✅ chip-cloud explosion | ✅ | ✅ mash bot wins | Done; only polish is in flight |
| 8 | Penthouse Pigeon · WTC | 09d_pigeon.js · pigeon 48755b6 | Rampage climb → ground brawl | P1: roof poop (wall shadow), swoops, chopper spotlight, live wires, water cannons, washer platforms. P2: pecks, poop puddles, bombing shadows, dive-low opening. | ◐ shake + score pops, combo exists; **no hitstop/trail/flinch flash** | ✗ (TONGUE is a verb, not a meter) | ◐ harbor knock-off; score tally | ✗ | ◐ long: 69–73 sim-s full chain | Hit feel, POWER, slow-mo harbor KO, grade |
| 9 | Pit Beef Pete · Lexington Market | 09d_pete.js · integration/pete 0c44dfb | Eating contest | Food-slide cheat (arm-lift tell, SWAT), hiccup prompts | **✗ zero juice** (0 hitstop / shake / pops) | ✗ | ◐ waddle-off | ✗ | ◐ | Everything visual; bites have no punch |
| 10 | Kingpin Carl · basement lanes | 09k_carl.js · game-carl, **uncommitted** | Duckpin bowling | Hecklers wobble aim (SWAT), greased lane frames 4 + 8, pin-kick cheat (SWAT to call it) | ✗ (1 pop) | ✗ (the "power" in this file is the ball meter) | ✗ | ✗ | ◐ deterministic sim, seeded AI miss | Strike/pin impact, special, KO, grade |
| 11 | Riptide Rodney · Rash Field | 09m_rodney.js · game-rodney, **uncommitted** | 2v2 lacrosse | Rodney + wingman cradle / pass / check; harbor rule | ✗ (puff fx only) | ✗ | ✗ | ✗ | ? | Goal/check impact, special, KO, grade |
| 12 | The Raven King · M&T | **unbuilt** (Opus O5–O7 rig pending) | TBD (kick return was offered) | Designed: "Nevermore" blitz | — | — | — | — | — | Build to standard from day one; gated by the Poe feather |
| 13 | Dr. Shellacious · Science Center IMAX | unbuilt | TBD | Designed: IMAX turtle-movie arena | — | — | — | — | — | " |
| 14 | The Hon Queen · Fed Hill | unbuilt | TBD | Designed: hairspray clouds, pushes you down the hill | — | — | — | — | — | " |
| 15 | Sugar Rush · Domino | unbuilt | TBD | Designed: sugar-crystal golem by the neon sign | — | — | — | — | — | " |
| 16 | The Compression King · Under Armour | unbuilt | TBD | Designed: athleisure mannequin brute | — | — | — | — | — | " |
| 17 | Chef Crabcake · Four Seasons | unbuilt | TBD | Designed: blinding seasoning, crab mallets | — | — | — | — | — | " |
| 18 | The Pool Shark · Pendry | unbuilt | TBD | Designed: pool then harbor throws | — | — | — | — | — | " |
| 19 | Captain Cobblestone · USS Constellation (night) | unbuilt; needs the Phantoms + ghost lantern | TBD | Designed: ghost privateer + lantern | — | — | — | — | — | " |
| 20 | The Stoop Scrubber · Washington Monument | unbuilt | TBD | Designed: scrub brush, slippery suds | — | — | — | — | — | " |
| 21 | The One-Eyed Brewmaster (FINAL, 3 parts) | unbuilt | Rooftop brawl → beer-truck chase → street fight | Designed: can-tower slam, foam geyser, mustache-twirl spin; kegs + foam slicks; broken-sign pieces | — | — | — | — | — | " |

**Count:** 21 bosses (11 built or written, 10 unbuilt) plus the street brawl. Of the 11 built, only the Chip Kid meets the standard. **Not one other fight has a POWER meter, and none has a star grade.**

Side set pieces not counted as bosses: stoop defense, rooftop run, Poe night, Bike Life, Grand Prix and fishing. They should borrow S2 (hit feel) and S6 (grade) when they are built.

---
## 2. Street gangs: current state and how distinct they are
**The key finding:** in the game, thugs have **no gang of their own**.
- 06_game.js spawns 30 posts from 5 generic human `THUG_LOOKS`: mohawk, beanie+pipe, cap, spikes+bat, bald bruiser.
- They all share one AI: idle → chase → windup → lunge attack → hurt / dizzy / down.
- 06f_barks.js only *labels* each thug with a gang by its nearest landmark (`TURF`), so it can pick GR1 speech lines.
- **Today the only difference between gangs is the text in their speech bubbles.**

Opus has delivered gang rigs for 4 gangs (hawk-relay READMEs; Otters on claude/o4-key-hwy-otters). None of them is wired into the game.

| Gang | Turf (06f_barks TURF) | Rig delivered (not in game) | In-game enemies today | Attacks today | Distinct? |
|---|---|---|---|---|---|
| Harbor Rats | North shore: Harborplace, Constellation, WTC, Washington Monument | Yes (Hark-fixed v2): grunt_a (navy watch cap + mustard), grunt_b (flat cap, chewed ear), bruiser (mustard do-rag, gold tooth). No armed variant. | Generic humans | Generic windup/lunge | Barks only |
| Pier Gulls | The piers: Aquarium, Power Plant | Yes (v1.1.2): grunt_a/b, bruiser, `gull_lookout` | " | " | Barks only |
| Cobblestone Catfish | Harbor East / Fells Point: Four Seasons, Pendry, Fells | Yes: grunt_a/b, armed (cobblestone in a net bag on a rope), flathead bruiser | " | " | Barks only |
| Masked Bandits | West side: Oriole Park, M&T, Science Center. Also Carl's hecklers and (assumed) Lexington Market night turf | Yes: grunt_a/b, armed (traffic cone), bruiser | " (in Carl's duel: heckle / grease / pin-kick stand-ins) | " | Barks only (unique only inside Carl's duel) |
| Key Highway Otters | South shore: Fed Hill, Domino, Under Armour, Fort; Rash Field (Rodney) | Yes on o4 branch | " | " | Barks only |
| Fells Point Phantoms | Night only, Broadway pier / Fells; Cobblestone's gang | **Not delivered** (O8 brief: Bosun Bones bruiser, Deckhand Dread grunt, Powder Monkey bomb-thrower, `setSolid`) | None | None | Not in game; needs the lantern from fishing |
| (Wheelie Kings) | Ride-out spots | — | — | — | A friendly racing crew, not a combat gang: out of scope here |

---
## 3. Per-boss proposals: signature attacks + a boss-themed Harold special or KO
Rules for every proposal:
- Every attack gets a ≥1.0 s tell: "!" + ground ring / lane flash + a sound sting, using the same visual language as the Chip Kid.
- Each boss's **specials are its own**. The street brawl keeps the Chip Kid's 3 generic specials only as a fallback.
- No real people, mascots, logos or trademarks: real place names are fine, and team and product names stay generic.

### Built fights (upgrade in place)
**Street brawl:** the gang moves are in section 4. For Harold: a POWER meter filled by hits, dodges and finishers, with 3 city specials that rotate:
- **OLD BAY CYCLONE**, shared with the Chip Kid.
- **STOOP STOMP**: a leap off the nearest stoop or ledge; the shockwave launches the whole ring of thugs.
- **MAVIS PURSE-NADO**: Mavis spins in front of Harold and hoovers thugs into a tornado; Harold bats the cluster with a slow-mo homer swing.
- **KO flourish:** the last thug of a post goes down in 0.3x slow-mo with a camera orbit, then a "BLOCK CLEAN!" star card counting hits taken.

**1. Admiral Redclaw (gallery)**
- *Broadside Claw Volley:* the flagship's gunports light up one by one, left to right, over 1.5 s, then fire in that order. Shoot a lit port to snuff it.
- *Boarding Hook:* Redclaw fires a grapnel at the fort's storm flag. The rope glows for 2 s; shoot the rope or lose a big chunk of flag.
- *Rockets' Red Glare Spiral:* ghost red trails trace each rocket's path 1 s before launch.
- **Harold special "ANTHEM BARRAGE":** the meter fills from mid-air intercepts. All the fort's cannons fire on the anthem's high note, in slow-mo, as fireworks-tinted shots.
- **KO:** Redclaw is blown off the quarterdeck clutching his tricorn, tumbles in slow-mo into the bay, and the flagship sinks bow-up while the big flag rises.

**2. Voltage Vic (rhythm)**
- *Lights-Out Drop:* a 4-beat "LIGHTS… OUT…" countdown, then 2 bars where only the glowing note heads are visible.
- *Eel Coil Crossfade:* lanes swap places on beat 4, with an animated lane slide and a whoosh a bar ahead.
- *Feedback Loop:* Vic replays the pattern you last missed, faster. The lanes tint red first.
- **Harold special "POWER SURGE STOMP":** the meter fills from perfect streaks. Harold plants his cane on the downbeat and the current runs back up the cables: one bar of auto-perfects while Vic fries.
- **KO:** the decks overload, the Power Plant stacks spark, and Vic short-circuits into a frizzy static halo. He floats down in slow-mo under a record-scratch stop.

**3. Bird Brain Bobby (derby)**
- *Flap-Ball:* Bobby flaps mid-windup (feathers puff) and the ball hops halfway to the plate.
- *Triple Toss:* three balls come at once and only the glowing one is real. A "WHICH ONE?" tell shows during the windup.
- *Stretch Fake:* a full windup with no release. The crowd yells "HOLD IT!" (the tell); swinging counts as a strike.
- **Harold special "CALLED SHOT":** the meter fills from perfect contacts. Harold points his cane at the warehouse, the next contact is a guaranteed slow-mo moonshot through a warehouse window, and it counts as 2 homers.
- **KO:** Bobby spikes his cap and stomps it, feathers fly, and he sulks into the dugout while the scoreboard fireworks go off.
- **Difficulty:** widen the phone contact window to about 0.2 s and drop the target to 8 HR before 10 outs.

**4. Arabber Al (chase)**
- *Melon Bowling:* 3 watermelons roll across the lanes, and the lanes flash 1 s before.
- *Brake-Check Buck:* Al yanks the reins and the cart's lanterns flash red. Back off within 1 s or the horse bucks you into a spin.
- *Bell Shortcut:* Al rings his bell and cuts down an alley, shown by a minimap arrow + bell sting. Follow or lose time.
- **Harold special "MAVIS HANDBRAKE SLINGSHOT":** the meter fills from near-misses. Mavis yanks the brake, the car drifts and slingshots into a guaranteed slow-mo ram, and produce explodes everywhere.
- **KO:** a cart wheel pops off and produce rains down in slow-mo. Al lands in cabbages holding up a peach; the horse trots off happy.

**5. Dragon Boat Duchess (boat race)**
- *Drum-Beat Surge:* her drummer pounds 3 beats, then she charges dead straight down a lit lane.
- *Dragon's Breath:* the dragon head mists a cone that hides buoys for 2 s. Tell: the head inhales and glows.
- *Royal Whirlpool:* her sceptre stirs a whirlpool ring that drags boats in, with a spiral decal 1.5 s ahead.
- **Harold special "DOWN THE OCEAN, HON!":** a wake-jump ram. The boat launches off her own wave in slow-mo and lands on her stern.
- **KO:** the dragon head pops off and floats away, her tiara arcs into the harbor, and she paddles off on the dragon head.

**6. Big Jimmy (swim)**
- *Molt Phase:* at 50% the shell cracks and glows, then pops off. Soft-shell Jimmy is faster, but every hit crits.
- *Pinch Vortex:* he spins his claws to pull you in. Current arrows show 1.2 s ahead; swim against them.
- *Crab-Pot Drop:* a pot's shadow sweeps the sand, then a cage drops. Mash to break out.
- **Combo:** STRIKE becomes a 3-hit cane flurry with a finisher uppercut that flips him.
- **Harold special "STEAMPIPE BUBBLE JET":** Harold rides a vent's bubble column, rockets into Jimmy's belly, and Jimmy spins.
- **KO:** Jimmy spins dazed in slow-mo, bubbles spell "UNCLE!", and he settles on the sand claws-up, then scuttles off.
- **Difficulty:** tells ≥1.0 s, HP 240, and no homing bubbles below phase 3.

**7. The Chip Kid:** reference. Already unique: seasoning cloud, chip-can barrage, bag-slam, claw jab. No new moves.

**8. Penthouse Pigeon**
- *Sparkling-Cider Cork Barrage:* corks pop from the penthouse in a fan; the wall flashes where each will hit.
- *Wing Gust Sweep:* he fans the face and pushes Harold one window sideways. Telegraphed by a dust line.
- *Tea-Tray Frisbee:* a silver tray boomerangs out and back across the ground. A dashed arc shows its path.
- **Harold special "TONGUE TORNADO":** Harold tongue-grabs the Pigeon, swings him round 3 times in slow-mo and releases him into a billboard.
- **KO:** the Pigeon skids across the promenade into the harbor in slow-mo; his smoking jacket floats, his monocle sinks.

**9. Pit Beef Pete**
- *Gravy Flood:* steam rises over Pete's pot (tell), then gravy floods your plate: +bites unless you SWAT the ladle.
- *Counter Bump:* Pete leans back, then bumps the counter and your plate slides. Hold SIP to steady it.
- *Horseradish Heat:* the course's sauce is "HOT!", the screen ripples, and sips have to land in a timing window.
- **Harold special "BOTTOMLESS HAROLD":** the meter fills from rhythm bites. Harold's toad tongue slurps the whole plate in one slow-mo pull, with crumbs flying.
- **KO:** Pete's apron strings snap, he slides off his stool in slow-mo, belly-flops, and waddles off groaning.
- **Hit feel for bites:** a crunch sfx, crumb debris, a fullness bar shake, "+1 PLATE" pops.

**10. Kingpin Carl**
- *Towel Snap:* Carl twirls his lucky towel during your power meter and the needle jitters for 0.5 s. The twirl gives a 1 s tell; tap SWAT to block it.
- *Play-Dead Gambit:* Carl "faints" on the approach and a Bandit sneaks two pins back up.
- *Lucky Polish:* he buffs his own rack, and those pins wobble less (they glow gold).
- **Harold special "CANE CURVE":** Harold banks the ball off the kickback in slow-mo for a guaranteed strike; the pins burst like fireworks.
- **KO:** Carl plays dead for real with the towel over his face, and the Bandits carry him off.
- **Hit feel:** pin-impact hitstop + shake on strikes, "STRIKE!" / "SPARE!" pops.

**11. Riptide Rodney**
- *Riptide Roll:* Rodney rolls across the field on his back like a floating otter and bowls over everyone in his path. A dust trail shows 1 s ahead.
- *Clam-Crack Shot:* a bounce shot off a rock that changes direction. The rock glows.
- *Harbor Shove:* a shoulder check aimed at the seawall. An arrow shows 1 s ahead; dodge or swim.
- **Harold special "GIVE-AND-GO":** a cane-and-purse slow-mo pass-and-score that can't be blocked.
- **KO:** Rodney flips into the harbor and floats on his back hugging his stick; his wingman paddles him away.

### Unbuilt bosses (build straight to the standard)
**12. Raven King** (style: blitz duel on the field)
- *Nevermore Blitz:* a straight-line charge marked by a black feather trail.
- *Feather Fumble:* a crow swarm knocks the cane loose; mash to grab it back.
- *Shoulder-Pad Sack:* a leap with a landing shadow.
- **Special "HAIL MAVIS":** Harold launches Mavis's purse in a slow-mo spiral to the end zone.
- **KO:** flattened in the end zone, feathers rain as confetti, the scoreboard flips "NEVERMORE" to "EVERMORE".

**13. Dr. Shellacious** (IMAX)
- *Shell Ricochet:* he tucks into his shell (it glows) and bounces off the screen walls.
- *3D Beaker Lob:* the arena goes red/cyan, and you dodge the beakers' shadows.
- *Freeze-Frame:* the projector pauses the movie and freeze rays run along the film-strip lanes.
- **Special "PLOT TWIST":** Harold cane-flips him onto his back.
- **KO:** he spins helplessly on his shell while original-film credits roll over him.

**14. The Hon Queen** (Fed Hill slope)
- *Hairspray Cloud:* a cone, telegraphed by the can shake.
- *Beehive Boulder:* her hair rolls downhill along a lit lane.
- *Lawn-Flamingo Toss:* arcs with landing rings.
- **Special "SALON SHOWDOWN":** Mavis's afro vs the beehive, Mavis pins her, and Harold finishes.
- **KO:** the beehive deflates and she rolls downhill in slow-mo onto a stoop, saying "Go get a crab cake, hon."

**15. Sugar Rush** (Domino roof)
- *Crystal Spikes:* ground rings, then spikes.
- *Sugar-High Dash:* after-images mark her path.
- *Molasses Pool:* a slow zone in amber.
- **Special "NEON OVERLOAD":** Harold cane-cracks the sign's conduit and a neon beam fries her.
- **KO:** she dissolves into a slow-mo sugar avalanche that rains sugar cubes.

**16. The Compression King** (clothing store)
- *Mannequin Freeze:* red-light/green-light. Move while the lights are red and the mannequins strike.
- *Big Squeeze:* a bear-hug lunge with a 1.2 s crouch tell; mash QTE.
- *Hanger Boomerang:* a dashed arc.
- **Special "CLEARANCE SALE":** Harold spins through a clothing rack in a fabric tornado.
- **KO:** his seams split and he deflates like a vacuum bag into a bargain bin.

**17. Chef Crabcake** (hotel kitchen)
- *Seasoning Blind:* he shakes and the screen goes orange.
- *Twin-Mallet Drumroll:* 4 counter slams across the lanes.
- *Flambé Line:* a fire line runs along the counter after a pan-tilt tell.
- **Special "CHEF'S FLIP":** Harold flips him in a giant skillet.
- **KO:** he's launched into the walk-in, the door slams, and an "86'd" sign drops.

**18. The Pool Shark** (Pendry pool deck)
- *Cue-Ball Break:* aim lines show first.
- *Cannonball:* a wave ring.
- *Fin Circle:* a dorsal fin circles, then lunges when the circle closes.
- **Special "BANK SHOT":** Harold banks thugs off the pool edge into the harbor.
- **KO:** a belly flop with no splash, then he floats off on a pool float in sunglasses.

**19. Captain Cobblestone** (Constellation deck, night)
- *Lantern Sweep:* in the cone you turn ghostly and drain.
- *Ecto-Broadside:* gunports glow, then fire.
- *Rigging Swing:* he swings across the deck on a shadow arc.
- **Special "GHOST-LANTERN FLARE":** he turns solid, then a slow-mo cane flurry.
- **KO:** he dissolves into fog, his tricorn clunks on the deck, the ship's bell tolls, and the Phantoms scatter.

**20. The Stoop Scrubber** (monument steps)
- *Suds Slick:* foam lanes.
- *Bucket Dump:* a shadow, then a splash.
- *Marble Glare:* she polishes a step, and the reflected beam blinds along a lit line.
- **Special "STOOP SURF":** Harold rides her scrub brush down the steps into her.
- **KO:** she slips on her own suds, slides down every step in slow-mo into the fountain, and laughs "Okay hon."

**21. The One-Eyed Brewmaster** (3 parts)
- **Part 1:** *Can-Tower Slam*, a stacked shadow then a slam. *Foam Geyser*, rooftop vents hiss and glow. *Mustache-Twirl Spin*, a wind-up twirl then a spinning sweep with a ring.
- **Part 2:** rolling kegs and foam slicks, plus *Tailgate Drop*: the truck's doors flash before kegs pour out.
- **Part 3:** *Broken-Sign Swing* with a sparking arc and *Monocle Glare*, a squint glint then a beam.
- **Special "TENURED TEAM-UP":** Harold and Mavis's combined cane + purse finisher.
- **KO:** a slow-mo harbor-KO splash; his hat floats as the brewery-tower sign lights. Original lettering only.

---
## 4. Per-gang proposals: style, 2 signature moves, a unique variant, a defeat/flee gag
All 6 gangs share one rule: every gang move gets a readable tell (≥0.6 s for grunts, ≥0.9 s for heavies), shown as a coloured rim flash in the gang's colour.

| Gang | Fighting style | Signature move 1 | Signature move 2 | Unique enemy variant | Defeat / flee animation |
|---|---|---|---|---|---|
| Harbor Rats | Swarm and steal: hit-and-run, they always try to flank behind Harold | **Tail-Whip Trip**: a low sweep (tell: tail lifts + mustard flash); JUMP over it | **Snack Snatch**: a rat steals a slice of POWER meter and bolts; KO him within 6 s to get it back | **Manhole Mugger**: pops out of the nearest manhole behind Harold (ties into the sewer system) | Scurries to a storm drain and dives in; if knocked into the harbor, floats away clutching a cheese wedge, with a "squeak" pop |
| Pier Gulls | Aerial: they hover out of reach, then dive | **Dive Bomb**: a ground shadow shrinks for 0.9 s, then a dive; a dodge leaves the gull stuck beak-first in the boards (free hits) | **Fry Heist**: two gulls grab Harold's hat (screen tint), swat them to get it back | **Gull Lookout** (rig delivered): perched on lamp posts, squawks to call 2 more gulls in; hit the post to knock it off | Feather puff, then a wobbly flap off into the sky leaving drifting feathers; harbor KO = paddles off grumpily |
| Cobblestone Catfish | Slippery grapplers: hard to stagger, they slide | **Barbel Lash**: a 3-hit whip combo (tell: barbels curl + teal glow) | **Mud Slide**: a belly-slide tackle along the cobbles that leaves a slick streak, which also trips other thugs | **Flail Spinner** (armed rig): spins the cobblestone net bag in a widening circle; time the gap to get in | Flops on the cobbles, wriggles into a gutter grate; harbor KO = joyful flop-splash, then bubbles |
| Masked Bandits | Sneaky thieves: block from the front, ambush from the back | **Trash-Lid Shield**: blocks frontal hits (clang sparks); hit from behind or jump-attack to break it | **Cone Toss** (armed rig): throws a traffic cone; a hit makes Harold wear it (blinded edges for 1.5 s) | **Dumpster Diver**: hides in a dumpster or bin and bursts out (the lid rattles 1 s first) | Drops loot (coins or a crab cake), dives into a trash can, the lid slams, and the can rolls off down the street |
| Key Highway Otters | Tag-team: they fight in pairs and swap in | **Rock-Crack Combo**: pebble toss, then a slam (tell: rock held up + it shines) | **Paw-Hold Spin**: two otters link paws and spin as one hazard (a ring on the ground); split them with a hit to the middle | **Seawall Splasher**: floats in the water by the promenade and splashes Harold (a wave ring), only reachable from the edge | Belly-slides off the seawall into the harbor and floats away on its back, waving |
| Fells Point Phantoms (night) | Untouchable until lit: they drift through attacks | **Fog Blink**: teleports behind Harold (fog puff at the target spot first) | **Spectral Powder Bomb** (Powder Monkey): a lobbed bomb with a landing ring | **Bosun Bones**: a bruiser with an anchor-swing sweep; only staggers while the lantern is lit | Lantern-lit KO: turns solid, sinks with bubbles and a ghostly "blub". Unlit: dissipates into fog and reforms 5 s later |

Plus one shared change: each gang drops its gang's loot, and each district gets its gang's colour on the post marker.

---
## 5. Phased work plan (parallel worktrees, low file overlap, ordered by impact)
**Hard dependency:** hark/chipkid-fun has to merge into hark/integration before any task that uses the juice API starts. It owns 09a_duel_core.js and 09c_chipkid.js, and they are being edited right now. Every task below branches from hark/integration *after* that merge.

### Phase 0: shared core (1 task, serial, small)
**T0 `juice-core`** is the only task allowed to touch 09a after chipkid-fun lands.
- **New file:** src/05b_juice.js, a global `JUICE` with the same API as the 09a block (hitstop/slowmo/shake/zoom/flash/pop/combo/power/ready/impact/hitSfx/trail/debris/sprites) plus `JUICE.bind(camera, hudRoot)`. Binding lets non-duel modes (derby, racers, Vic, fort, city) project pops and shake their own camera.
- **New helpers:**
  - `JUICE.tell(pos, kind, secs)`: a "!" + ground ring/lane flash.
  - `JUICE.grade(stats, {s, a})`: the star card + REMATCH.
  - `JUICE.koCine(opts)`: slow-mo + orbit + flash + exit-gag callback.
  - `JUICE.special(name, opts)`: the zoom/slow/flash choreography.
- **Edit:** 09a, so its `D.*` become thin aliases. Small edit.
- **Also writes:** handoff/CHIPKID_STANDARD.md (the S1–S7 checklist), a `bot=mash` test template, and a 390 HUD lint.
- **Touches:** new 05b, 09a, build list. Blocks all of Phase 1 and later.

### Phase 1: highest impact (what every player hits first). One small serial hook commit, then 4 builders in parallel
- **T1h `brawl-hooks`**, serial, about 30 lines. Adds `BRAWL.hooks = { onHit, onHurt, onKO, enemyTick, spawnLook, powerFill }` to 06_game.js (hitEnemy, hurt, updateEnemy default, POSTS spawn) and 06b_cine.js (powerImpact / startPower), each hunk tagged `// brawl-hooks:`. After this, T1a and T1b never touch 06_game.js.
- **T1a `brawl-juice`**:
  - New file src/06j_brawl_juice.js.
  - Damage numbers, cane trail, flinch flash and the combo finisher pop.
  - POWER becomes a meter filled by hits, dodges and finishers (the 7 s cooldown is gone).
  - Specials: Cyclone / Stoop Stomp / Purse-nado.
  - "BLOCK CLEAN!" slow-mo last-thug KO + star card.
  - Touches the new file only (plus 06d_panel only if the ACT pulse needs a class).
- **T1b `gang-framework`**:
  - New file src/06k_gangs.js: one gang id per POST from TURF (reuse the 06f_barks mapping, exported), and a per-gang behavior table (tell colour, HP, attack set, variant spawn, defeat gag).
  - Wire the Opus rigs (rats, gulls, catfish, bandits, otters) as vendor files src/02d_gang_*.js through mergeRig, with the generic THUG_LOOKS as fallback.
  - Ships the variant slot and defeat gags only; signature moves come in Phase 3.
  - Touches new files only. **Watch city draw calls** (≤+10%).
- **T1c `jimmy-fun`**: 09b_jimmy.js only. 3-hit strike combo, POWER + Steampipe Jet (plus the generic set), Molt phase, Pinch Vortex, Crab-Pot, slow-mo KO, grade, difficulty retune. Fixes the worst gap among the live bosses.
- **T1d `pete-fun`**: 09d_pete.js only. Bite juice, Gravy Flood / Counter Bump / Horseradish, Bottomless Harold, KO, grade.

### Phase 2: the other built bosses (up to 4 parallel; every row is one file)
- **T2a `pigeon-fun`**: 09d_pigeon.js on hark/pigeon, rebased after T0. Hit feel, Cork Barrage / Wing Gust / Tea-Tray, Tongue Tornado, slow-mo harbor KO, grade; trim the chain toward ~50 sim-s.
- **T2b `derby-fun`**: 06g_derby.js. JUICE.bind, contact hitstop, Flap-Ball / Triple Toss / Stretch Fake, Called Shot, KO, grade, phone window 0.2 s and 8 HR.
- **T2c `racers-fun`**: 06h_racers.js (Al + Duchess, one file, so one task). Al: Melon Bowling / Brake-Check / Bell Shortcut + Handbrake Slingshot. Duchess: Drum Surge / Dragon's Breath / Whirlpool + Wake Jump. KO + grade for both.
- **T2d `vic-fun`**: 06v_vic_rhythm.js. Note-hit flash/hitstop, Lights-Out / Coil Crossfade / Feedback Loop, Power Surge Stomp, KO, grade.
- **T2e `fort-fun`**: 09_fort.js. Kill hitstop, Broadside / Boarding Hook / Spiral, Anthem Barrage, grade on the flag.
- **T2f `carl-fun`** and **T2g `rodney-fun`**: 09k_carl.js / 09m_rodney.js. **Precondition:** those branches are committed first. Their locks are stale per PARALLEL_BUILDER, so the pending tests + commit have to be finished before these start.

### Phase 3: unique gang moves (3 parallel; one file per gang, data-driven by T1b)
- T3a: src/06k1_rats.js + 06k2_gulls.js.
- T3b: 06k3_catfish.js + 06k4_bandits.js.
- T3c: 06k5_otters.js.
- Later, T3d: 06k6_phantoms.js. **Blocked** on the Opus O8 Phantom rigs, the ghost lantern (fishing side mission) and Cobblestone.

Each gang task: 2 signature moves, the variant, the defeat gag, plus a `?gangtest=<id>` arena param. Files are disjoint.

### Phase 4: unbuilt bosses, built straight to the standard (each one new file on the duel core + an ACT anchor in 07_main.js, append-only)
Order follows the open-world route and how ready each is (no extra gates first):
1. Hon Queen (09n), Sugar Rush (09o), Chef Crabcake (09p), Compression King (09q).
2. Pool Shark (09r), Stoop Scrubber (09s), Dr. Shellacious (09t, wants the S2 IMAX interior).
3. Raven King (09u, gated by Poe night) and Captain Cobblestone (09v, gated by the Phantoms + lantern).
4. The Brewmaster last, at max effort (09w + reuse of the 06h ram logic for part 2).

Up to 4 builders at once. Each reuses `JUICE.tell/grade/koCine/special` and copies 09c's structure. Rig hooks stay as `build<Name>()` stand-ins until the Opus rigs land.

### Shared-file contention summary
| File | Who touches it | How it's handled |
|---|---|---|
| 09a_duel_core.js | chipkid-fun (now), then T0 only | Serial |
| 06_game.js, 06b_cine.js | T1h only | Serial hook commit; everyone else uses the hooks |
| 07_main.js | Phase 4 entries (ACT labels), maybe T1a (frame tick) | Append-only `// <feature>:` hunks |
| 08_radio.js | None expected (modes already duck it) | — |
| 06f_barks.js | T1b exports TURF (a one-line change) | Fold it into T1h to keep it serial |
| Build list / gen.sh | Every new file | Append-only |

### Done criteria added to PARALLEL_BUILDER for every task
- A `bot=mash` (or genre equivalent: `bot=sloppy` for timing modes) **wins while taking ≥2 hits**, and the scripted lose path still loses.
- Grade card + REMATCH show at 390x844 with no clipping.
- Each new boss move has a visible tell ≥1.0 s, checked in a 390 screenshot (`assets_preview/<feature>_tell_390.png`).
- City draw calls within 10% (matters most for T1b).

## Added requirement (Brad, 2026-10-12 18:03 ET): Harold's moves differ per battle
"Our character should have a slightly different swing or move for each battle too."
- Every boss fight AND every gang gives Harold a fight-specific move variant on top of the shared 3-hit cane combo: a different finisher swing/animation, trail colour, hit-pop words and SFX, themed to the opponent (e.g. Pete: fork-and-cane "carving" finisher; Pigeon: upward golf-swing uppercut; Jimmy: underwater slow spin-sweep; Bobby: baseball bat-flip homer; Vic: power-chord strum shockwave; gangs: e.g. Harbor Rats = hook-pull sweep, Pier Gulls = anti-air cane twirl).
- Implement in the juice core as a per-mode `moveset` descriptor (finisher anim id, trail colour, words, sfx, optional unique POWER special) so each fight file only declares its variant. Chip Kid keeps its current set as the reference.
- Done-criteria addition: no two fights share the same finisher animation + POWER special pair.

## Added requirement (Brad, 2026-10-12 18:04 ET): wild, clip-worthy team-ups and combos
"Double clothesline, stand on each other's back and jump kick, swing the other into them, any crazy karate move from movies or cartoons. Crazy combos people will want to clip and replay and post."
- Team-up specials with the partner (06c_partner.js, e.g. Mavis/wingman): Double Clothesline (both sprint through a line of thugs), Back-Boost Flying Kick (partner crouches, Harold vaults off her back), Giant Swing Toss (Harold spins the partner by the arms into the enemy), Human Bowling Ball, Wheelbarrow Kick Spin, Tandem Uppercut Launch + air juggle. Each: slow-mo, freeze-frame on contact, comic-panel splash text, camera punch-in.
- Movie/cartoon homage moves (original naming, no trademarks): crane-stance kick, spinning cane helicopter, 100-hand flurry ("Hon Hon Hon" rapid strikes), wall-run bounce kick, cartoon dust-cloud brawl, dog-pile slam.
- Combo system: chaining hits/specials into named combos ("CRAB CAKE COMBO x12", "BALTIMORE BEATDOWN") with escalating hit-stop, combo-tier announcer lines, and a big end-of-combo freeze frame.
- Replay (revised by Brad 18:08 ET): NO save-clip button. Only a short (~2-3 s) slow-mo replay of the final blow, played automatically right after a boss is defeated, skippable with a tap. No replays for gang fights or mid-fight.
- Done-criteria addition: every boss fight has at least one team-up special and every gang fight can trigger at least one; boss-defeat replay works at 390 px.
