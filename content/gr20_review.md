# GR20 — Design review: DESIGN.md vs content/gr1–gr19 (P-027, 2026-10-12)

Sources read: `relay/briefs/DESIGN.md` (neither `DESIGN.md` nor `docs/DESIGN.md` exists in the repo, so this is the only design file), `relay/briefs/HOMAGE.md`, and all 19 `content/gr*.json` files (gr1–gr19). Hit counts are case-insensitive greps over the concatenated gr*.json files.

## 1. DESIGN.md sections with no matching writing (6)

1. **Carry-over from Shell Shock 3D: sewers, metro, skateboard** (DESIGN top block + Phase 4). "metro" 0 hits, "manhole" 0, "sewer" 1 (a gr1 bark: "Somebody call the sewer, I'm out."), "skateboard" 1 (a gr18 pause joke). No how-to card, tutorial prompt or loading tip explains entering a sewer, riding the metro or skating.
2. **Storefront: Hooters at Harborplace** (Additions 08:11). "Hooters" 0 hits. No sign text, NPC line or landmark blurb for the Light St octagon storefront.
3. **Real signage rule (2026-10-11 08:49)** naming Barnes & Noble, Hard Rock Cafe, Phillips Seafood, water taxis. "Hard Rock" 0, "Barnes" 0, "Phillips" 0. The shop-sign lists (gr5, gr9, gr13) are all invented names.
4. **Penthouse Pigeon Part 1 climb hazards** (Additions 09:54). "helicopter" 0, golden mallet 0 ("mallet" hits are Chef Crabcake/crab-related). No popup/score text for the police helicopter swat, live-wire windows, water-cannon boats, window-washer platforms or the golden mallet.
5. **Bike Life track builder + Wheelie Kings rewards** (Additions 09:54). "track build" 0, "crew jacket" 0. No UI/editor text for placing ramps, mud pits, stoops and crowd zones, nor for the crew-jacket reward.
6. **Domino Sugar set piece: elevator to the roof** (landmark set pieces). "elevator" 0; "Domino" appears only as the gr1 landmark name "DOMINO SUGARS". No set-piece prompt, bark or banner for the roof fight by the neon sign.

## 2. Balance / pacing risks (10)

1. **Pit Beef Pete length mismatch.** gr4 `course_cards` lists 5 courses (CRAB CAKE … COOKIE TOWER) as DESIGN says, but the P-018 QA (content/g12_pete_pigeon_qa.md) found the build ends after 3 wins. *Fix:* pick one: ship 5 courses (and use all 5 cards) or cut the cards to 3.
2. **Bobby's derby runs long on phone.** DESIGN: "10 homers before 10 outs" with an escalating pitch mix, i.e. up to 19 pitches. *Fix:* 7 homers before 7 outs on touch, or a mid-derby checkpoint at 5 homers.
3. **Fort McHenry Bombardment has no checkpoint.** DESIGN: 4 waves, 3–4 minutes, lose when the flag falls. *Fix:* restart at the start of the failed wave with the flag at 50%.
4. **Penthouse Pigeon is two full fights back to back.** DESIGN: wreck all 5 tower faces, collapse, score tally, then a full ground fight. *Fix:* auto-checkpoint after the collapse tally so a ground-fight loss doesn't replay the climb.
5. **Final Brewmaster is three fights in one** (rooftop → chase with 3 rams → street fight). *Fix:* checkpoint at each part change; keep Part 3 HP short since the player has already "won" twice.
6. **Golden mallet may never appear.** DESIGN: ~1 in 40 windows, max 1 per face, seeded per run. *Fix:* guarantee one by the 3rd face if none has spawned (pity rule).
7. **Ghost lantern waits on the clock.** DESIGN: the first *night* cast off Broadway pier guarantees it, and day/night flips every 5 min, so a player arriving at dawn waits up to ~5 min. *Fix:* let the first cast after the Phantoms first appear land it at any time of day.
8. **Bike Life stacks two punishments.** DESIGN: turbo overheating stalls you on the shoulder AND over-long wheelies flip you; mid-air bumps crash you. *Fix:* make overheat a speed cap rather than a full stall on early courses.
9. **Rodney's water penalty snowballs.** DESIGN: a defender checked into the water is out 30 s in a first-to-5 2v2, which can hand over 2–3 goals. *Fix:* cut to 15 s or cap at one player out per team at a time.
10. **Economy is unpriced.** gr17 `shop_items` (15 items) and the Lexington Market health snacks have no prices; the only cost in content is gr14 "Ferry rides skip a district but cost five coins." *Fix:* add a single price table (coins earned per thug/boss vs item costs) before more shop text is written.

## 3. Tone clashes with HOMAGE.md (4)

HOMAGE.md: "Lean into Baltimore types (hon beehive, arabber cart, rowhouse stoop, formstone), always original" and "When unsure, choose the more original option."

1. **Near-trademark names in gr19.** `stat_titles` "Night Rider" (sounds like the TV show *Knight Rider*) and `radio_ads` "Captain Crumb's Bakery. Day-old bread, brand-new excuses." (sounds like the cereal mascot Cap'n Crunch). *Fix:* rename, e.g. "Pratt Street Prowler", "Aunt Dot's Day-Old Bakery".
2. **Generic, non-Baltimore side quests in gr16.** `sidequests` "Mural Touch-Up" ("…her faded mural on Rope Street"), "Bell Tower Echo" ("Ring the clock tower bell at exactly noon"), "Ferry Fare". No Rope Street exists in the game's map, and none use stoops, arabbers or formstone. *Fix:* anchor them to real game places (e.g. Bromo-style tower → an original clock tower on the map, a Fells Point mural, a water-taxi fare).
3. **Generic skate-shop items in gr17.** `shop_items` "Fogline Hoodie" ("very gray"), "Static Cap", "Rocket Wheels", "Turbo Pads" read like any city. *Fix:* swap 3–4 for Baltimore types, e.g. a formstone-pattern deck, an arabber-bell charm, a hon-beehive helmet.
4. **"Ferry" vs the design's water taxi.** gr14 loading tip "Ferry rides skip a district but cost five coins" and gr16 "Ferry Fare" use "ferry", while DESIGN and the real-signage rule use the water taxi. *Fix:* replace "ferry" with "water taxi".

(Checked and clean: no Utz, Natty Boh, Old Bay, Oriole Bird or team-logo references; Bobby's "No logo on this cap, just heat!" (gr3) matches the no-logo ballcap direction.)

## Self-check
- DESIGN file read: `relay/briefs/DESIGN.md` (DESIGN.md and docs/DESIGN.md are absent).
- List 1: 6 of max 10. List 2: 10 of max 10. List 3: 4 of max 5.
- Files: relay/briefs/HOMAGE.md, content/gr1–gr19 (19 files) all read/grepped; every quoted entry is copied from those files.
- Only content/gr20_review.md and relay/GROK_TO_HARK.md touched.
