# G18: Design and balance review, DESIGN.md vs review/integration-4e2f8d0 (P-055)

Sources: DESIGN.md isn't on the branch. I used relay/briefs/DESIGN.md (Brad, 2026-10-10 to 10-12, 142 lines), relay/briefs/HOMAGE.md, content/g3_qa_template.md, and the build at review/integration-4e2f8d0 (worktree HEAD 3115282, src/ + README). Play evidence comes from G16 and G17, which used headless bot runs. Everything else here is from reading the code.

Correction to G16/G17 signage notes: DESIGN.md "Real signage rule" (2026-10-11 08:49) overrides the no-brand rule for signs and storefronts ("Real wording and signs ... for the entire game"). The "Overrides" section separately approves the Domino Sugars script. So the UNDER ARMOUR, Domino Sugars, M&T and Hooters signs follow the spec. HOMAGE.md applies to characters only. G16 N1–N3 were wrong to flag them, apart from NEVERMORE, which is a design word ("Nevermore" blitz, "Nevermore Feather"). That makes the banned-term list from R-052 a writing-pack rule, not a build rule. Hark should confirm.

## 1. Boss modes

| # | Boss (file) | DESIGN promise | Built | Gap |
|---|---|---|---|---|
| 1 | Admiral Redclaw (09_fort.js) | Bombardment shooting gallery, 4 waves, flag as health | Built | Not reviewed in depth (out of G16/G17 scope) |
| 2 | Voltage Vic (06v_vic_rhythm.js) | Rhythm battle, radio song with a procedural fallback | Built | G14 B3: vicbars=4 can't be won |
| 3 | Bird Brain Bobby (06g_derby.js) | Home run derby | Built | — |
| 4 | Arabber Al (06h_racers.js) | Chase racer, 3 rams | Built (`?rb=al`) | — |
| 5 | Big Jimmy (09b_jimmy.js) | Underwater swim with an air meter | Built | G14 B2: camera jammed at 390 |
| 6 | Chip Kid (09c_chipkid.js) | Punch-Out mech, 3 rounds | Built | — |
| 7 | Dragon Boat Duchess (06h_racers.js) | Ambush on the first boat ride | Built (tcb_duchess_beaten) | — |
| 8 | Raven King (09v_ravenking.js) | Swarm fight on the field, gated by the feather | Built, with the gate at 09v:514-518 | Gate is bypassed by any ?duel param (09y_poe.js:20) |
| 9 | Dr. Shellacious (09t_shellacious.js) | IMAX turtle movie | Built | The lose path is very slow (G16: not reached in 120 s) |
| 10 | Hon Queen (09n_honqueen.js) | Hill brawl, push down the hill | Built | — |
| 11 | Sugar Rush (09o_sugarrush.js) | Roof by the neon sign | Built | — |
| 12 | Compression King (09q_compking.js) | Clothing store fight | Built | G16 B1: tell box overflows at 390 |
| 13 | Chef Crabcake (09p_crabcake.js) | Seasoning blind, mallets | Built | — |
| 14 | Pool Shark (09r_poolshark.js) | Pool, throw thugs into the harbor | Built | — |
| 15 | Captain Cobblestone (09u_cobblestone.js) | Night-only, needs the ghost lantern, Phantoms crew | Night gate built (09u:548-549); Phantoms only as arena extras (09u:133-139) | **Not gated on the lantern**: 09u:29 says "the ghost lantern from fishing is not built yet", but it is now (save.lantern, 09x:193) |
| 16 | Penthouse Pigeon | Rampage climb on the 5 WTC faces + ground fight | **MISSING**: only GR1 lines and a landmark stub (03_city.js) | Whole mode |
| 17 | Stoop Scrubber (09s_stoop.js) | Slippery suds | Built | — |
| 18 | Pit Beef Pete (09d_pete.js) | 5-course eating contest, clear your plate | Built | Undocumented change: "first to 3 courses wins" (09d:5) instead of all 5 courses |
| 19 | Kingpin Carl (09k_carl.js) | 10 frames, aim/spin/power, heckles, greased lane, Mavis bonus frame | Built: 10 frames, aim/power/spin, grease on frames 4/8, swat (09k:11-14) | **Mavis's purse bonus frame is missing** |
| 20 | Riptide Rodney (09m_rodney.js) | 2v2 lacrosse, out of play for 30 s if checked into the water, first to 5 | Built (OUTS=30, WIN=5, 09m:20) | — |
| 21 | One-Eyed Brewmaster (FINAL) | 3 parts: roof, beer-truck chase, street fight | **MISSING** (no file, no "brewmaster" anywhere in src) | Whole final boss |

## 2. Fishing (09x_fishing.js)
- Built and matches the design: 5 pier rings (09x:20-26), cast/hook/reel with tension and runs, 3 line snaps = lose, 5 catches = win, separate day and night lists, junk feeds Chompy, the guaranteed lantern on the first night cast at Broadway (09x:59), and the key as a 3%/6% rare (09x:60).
- Missing:
  - The **sewer stash** the key opens. The key only sets save.key (09x:194), and nothing reads it.
  - **"Chompy points you to Broadway once the Phantoms first show up"**: no such hint exists.
  - The **purse upgrade has no effect**: save.purse is set but never read. Only save.cane changes reel rate (09x:225).
  - The **lantern isn't used outside fishing**: no ACT "LANTERN" label, and no flash on Phantoms.
- Built but not documented:
  - Fish and crabs also feed Chompy, +4 and +6 (09x:192). DESIGN and the 09x:28 comment say junk only.
  - Perfect-cast band, BITE_WIN 0.9 s, 3 line snaps (09x:27).
- Balance:
  - G17 B1 (major): if a fish or crab crosses an upgrade threshold, the upgrade is lost forever (09x:195).
  - Cane at 100 points comes after about 4-5 junk-heavy hauls. The purse at 240 is about 10 hauls with no payoff.
  - Time-to-first-fun is good (first catch inside ~15 s on the bot).

## 3. Poe night (09y_poe.js)
- Built: chapter 1 graveyard sneak, 3 crows with lantern cones, tombstone line of sight, sneak, pebbles, 3 roses + unlabeled bottle, gate, feather saved, Raven King gate.
- Missing:
  - The **catacombs** under the church are only a door stub (09y:3, :86, "chapter 2 later").
  - The feather name is "Nevermore Feather" in code. GR38 offered "Midnight Quill", but DESIGN itself says "Nevermore Feather", so this is a policy call, not a gap.
- Built but not documented:
  - The gate bypass for `?duel`/`?duels`/`?feather`/bot (09y:20).
  - The day ring label "POE: AFTER DARK" (09y:9).
- Balance:
  - G17 showed SPOTTED within 16 s of standing still and within 60 s on the idle mobile run, which is fine.
  - The cone, line-of-sight and sneak tuning was never play-tested, because the win bot runs with detection off. There's a real risk of a difficulty spike for touch players: SNEAK is the L button held down while steering with the stick on a 390 screen.

## 4. Districts / world
- Built:
  - The 16 original landmarks + Lexington Market and Rash Field as landmarks with bosses (03d_lexington.js:137, :245).
  - Westminster (POE_ANCHOR, 03d:141).
  - The Hooters storefront (03d/09l).
  - Crime levels per landmark (06g0_boss_clear.js:4-10).
- Missing:
  - The **per-district crime HUD and the win state**. 06g0_boss_clear.js:3 says "the per-district crime HUD is phase 6".
  - **Fells Point Phantoms as a city gang.** There are 5 GR1 gangs and Phantoms isn't one (06f_barks.js:32-40). They exist only in Cobblestone's arena.
  - The Phantom rules: walking on water, punch-stun before you have the lantern.
  - The **Lexington day snack shop** (health snacks): no buy/snack code was found.
  - **Harbor Grand Prix**, **Baltimore Bike Life** (+ track builder), and **drone camera + celebration**: no code was found for any of them.
  - The **day/night cycle** is 2 min per the 01_core.js:3 header vs 5 min in DESIGN.
- Built but not documented:
  - The `?goto=` free-camera places (README:132).
  - The duckpin landmark id 'duckpin' (09k:8). DESIGN says Carl clears the Lexington district.

## Gap count
- Missing from the build (DESIGN promises, no or partial code): 16.
  - Pigeon mode, Brewmaster, Carl's Mavis bonus frame, the Cobblestone lantern gate, the sewer stash, the Chompy Broadway hint, the purse upgrade effect, the lantern ACT/flash, Poe catacombs, the crime HUD + win state, the Phantoms city gang, the Phantom water/stun rules, the Lexington snack shop, Grand Prix, Bike Life, drone + celebration.
- Built but not documented: 7.
  - Pete best-of-3, fish/crab feeding Chompy, fishing tuning constants, the feather-gate test bypass, the Poe day label, ?goto places, Carl's district id.
- Mismatches: 2 (the 2-min vs 5-min cycle, and Carl's district).
- Balance concerns: 6.
  - The Chompy threshold bug, the purse being worthless, the Shellacious lose time, the untested Poe stealth tuning, SNEAK hold + stick on 390, and Compression King/Jimmy at 390.

## Top 10 fixes, ranked by impact
1. **Chompy upgrade lost at the threshold** (progress loss for every player who fishes): 09x_fishing.js:195. Subtract the points actually gained.
2. **Build the final boss, the One-Eyed Brewmaster** (the game has no ending without it): new file. Wire it into BOSS_CLEAR (06g0_boss_clear.js:4).
3. **Crime HUD + win state** (the core goal from DESIGN line 6 isn't visible): 06g0_boss_clear.js:3-10.
4. **Gate Captain Cobblestone on save.lantern** and add the ACT "LANTERN" flash: 09u_cobblestone.js:29 and :548-549, reading `__fishing.save.lantern` (09x:193).
5. **Penthouse Pigeon mode** (the only landmark boss with no fight): landmark stub in 03_city.js. New 09 file.
6. **Make the purse upgrade do something** and add the sewer stash for the key, so two rewards aren't dead: 09x_fishing.js:194 and :225.
7. **Fells Point Phantoms city gang** (night spawns, walk on water, stun-only without the lantern): 06f_barks.js:32-40 TURF + GR38 phantoms_barks.
8. **Close the feather-gate bypass** so it's limited to an explicit test flag: 09y_poe.js:20 (drop `Q.has('duel')`).
9. **Mobile 390 fixes**: the Compression King tell overflow (09a_duel_core.js:41) and the Jimmy camera (G14 B2, 09b_jimmy.js).
10. **Day/night cycle at 5 min per DESIGN** (or update DESIGN): 07_main.js:108 cycle driver and the 01_core.js:3 header. Add Carl's Mavis bonus frame (09k_carl.js:8-14) in the same pass.

Not ranked (later passes, large scope): Grand Prix, Bike Life, drone + celebration, Poe catacombs, Lexington snack shop.

## Self-check
- Sections covered: 4/4 (bosses, all 21 in the roster; fishing; Poe night; districts).
- Gaps: 16 missing, 7 undocumented, 2 mismatches, 6 balance concerns.
- Top 10 is ranked by impact, with file:line on each.
- HOMAGE.md: every built boss is an original character. I saw no real people in the reviewed files.
