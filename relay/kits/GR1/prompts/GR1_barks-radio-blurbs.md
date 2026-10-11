# GR1 · Writing: thug barks, boss lines, radio bumpers, landmark blurbs
**For:** Grok · **Setting:** Grok (newest), default settings. · **Depends on:** None. Send any time. · **Delivers: a reply in this chat**

Attach `Toad_City_Round2_GROK.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Output one JSON object in the exact schema of §4. No prose inside it.
2. Valid JSON: double quotes, no trailing commas, no comments.
3. PG-13: mild language only; no slurs; no real people; no real gangs; no real brand jokes.
4. Baltimore slang welcome (hon, down the ocean, jawn is Philly so skip it, "yo", "B-more", "Charm City") but readable to anyone.
5. Every line ≤ 70 characters (barks ≤ 48) so it fits a phone speech bubble.
6. Counts are exact: count before you finish.
7. Station ids and landmark ids exactly as listed; never invent new ones.
8. Radio bumpers never name real songs or artists; they are station voice only.
9. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.

## Step 0 · Comprehension check (at the TOP of your reply, then continue straight into the full deliverable in the same reply)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. How many barks per gang per category, and which categories?
   - Q2. How many DJ bumpers in total, and which station ids?
   - Q3. How long is each landmark blurb?
   - Q4. How many landmarks, and where do their ids come from?
   - Q5. What content rating, and what is banned?
   - Q6. Which boss is the final boss?
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

Then continue straight into the full deliverable in this same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed. Brad hands your whole reply to Hark, who checks the Step 0 answers.

## ZIP contents
| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/radio_stations.js` | The station ids, names and track lists from the game's `src/08_radio.js` (excerpt). |
| `reference/landmarks.js` | The game's `LANDMARKS` list (ids, popup names, bosses) from `src/03_city.js`. |
| `reference/roster.md` | Gangs and the 17 bosses with their approved concepts. |
| `reference/screens/` | Game screenshots for tone. |
| `prompts/` | The GR1 session prompt. |

## 1 · Context
Toad City Baltimore: you play Harold, an elderly toad with a cane, beside his wife Mavis (grey afro, handbag), cleaning crime out of Baltimore's Inner Harbor. Thug gangs are anthropomorphic Chesapeake animals; each landmark has an original boss. A radio (B-MORE 410 RADIO) plays between fights, and a popup names each landmark as you arrive.

## 2 · Where writers fell short last round
Nobody wrote for us last round, but our builders lost time on values the game could not consume. So: ids must match the game's exactly, counts must be exact, and lines must fit the phone bubbles.

## 3 · The task
**Gangs (id → who):** `harbor_rats` Harbor Rats (Norway rats, north shore: Harborplace, Constellation, WTC, Washington Monument; mustard + navy) · `pier_gulls` Pier Gulls (herring gulls, the piers: Aquarium, Power Plant, Four Seasons; white + blue) · `cobble_catfish` Cobblestone Catfish (channel catfish, Fells Point and Pendry; slate + teal) · `masked_bandits` Masked Bandits (raccoons, west side: Oriole Park, M&T Bank Stadium, Science Center; orange + grey) · `key_hwy_otters` Key Highway Otters (river otters, south shore: Federal Hill, Domino Sugar, Tide Point, Fort McHenry; green + brown).
- Per gang: 8 barks each for `idle`, `taunt`, `hit` (when struck), `ko` (when knocked out). Each gang has its own voice.

**Bosses (id → concept):** `bird_brain_bobby` Bird Brain Bobby (A rogue bird mascot (orange-and-black songbird, original design) who pitches fastballs down a brick warehouse hallway) · `raven_king` The Raven King (A giant raven linebacker in shoulder pads (original colours) with a "Nevermore" blitz charge) · `dr_shellacious` Dr. Shellacious (A mad snapping-turtle scientist in a lab coat and goggles who fights in the IMAX theatre) · `hon_queen` The Hon Queen (Beehive hair, cat-eye glasses and leopard-print capris; throws hairspray clouds and shoves you down the hill) · `sugar_rush` Sugar Rush (A sugar-crystal golem, faceted and glittering, glowing at night beside the neon sign) · `compression_king` The Compression King (An athleisure mannequin brute in blank, unbranded gear) · `admiral_redclaw` Admiral Redclaw (A redcoat crab admiral from 1812 with a cannon arm firing rocket barrages) · `big_jimmy` Big Jimmy (A giant blue crab (a male "jimmy") fought underwater) · `voltage_vic` Voltage Vic (An electric-eel DJ whose attacks drop on a Baltimore club beat) · `chef_crabcake` Chef Crabcake (A chef who throws blinding seasoning and swings two crab mallets) · `arabber_al` Arabber Al (A street-produce arabber on a souped-up horse-cart that runs a car chase) · `pool_shark` The Pool Shark (A shark hustler in a cabana shirt and sunglasses, with a pool-cue attack and a belly-flop splash) · `dragon_boat_duchess` Dragon Boat Duchess (Rides a giant dragon paddle boat; regal and tiara'd, with a paddle-sceptre) · `captain_cobblestone` Captain Cobblestone (A ghost privateer: translucent glow at night, cutlass and lantern) · `penthouse_pigeon` The Penthouse Pigeon (A rich pigeon in a smoking jacket on a rooftop deck) · `stoop_scrubber` The Stoop Scrubber (A marble-step matriarch with a scrub brush, a bucket and slippery suds) · `mister_formstone` Mister Formstone (final boss) (A crime lord whose face and body are fake-stone (Formstone) armour plates that crack off in phases to reveal the creature beneath)
- Per boss: 3 `intro` lines (one is picked when the fight starts) and 3 `defeat` lines.

**Radio:** B-MORE 410 RADIO. Station ids and display names, exactly as the game stores them: `auto` AUTO (follows day/night), `day` B-MORE 410 DAY, `night` B-MORE 410 NIGHT, `ducky` DUCKY DYNAMO FM, `lor` LOR BITEWHO, `club` B-MORE CLUB, `rap` B-MORE RAP. Write **10 DJ bumpers total** (station voice between songs, 1–2 sentences, ≤ 70 chars per line), each tagged with one station id; at least one bumper per station id.

**Landmarks (id → popup name), exactly the game's LANDMARKS list:** `harborplace` HARBORPLACE · `constellation` USS CONSTELLATION · `wtc` WORLD TRADE CENTER · `aquarium` NATIONAL AQUARIUM · `powerplant` POWER PLANT · `fourseasons` FOUR SEASONS · `pendry` PENDRY · `fells` FELLS POINT · `monument` WASHINGTON MONUMENT · `orioles` ORIOLE PARK · `ravens` M&T BANK STADIUM · `science` SCIENCE CENTER · `fedhill` FEDERAL HILL · `domino` DOMINO SUGARS · `underarmour` UNDER ARMOUR · `fort` FORT MCHENRY
- Per landmark: a 2-sentence popup blurb (first sentence: the real place in plain words; second: a funny Toad City twist tied to its boss or gang). Real facts must be true.

> **Canary 1 of 3 (required in your delivery):** Output JSON: top-level key "_canary" with value exactly: `tcr2-gr1-pratt-street-pigeon`

## 4 · Exact schema
```json
{
  "_canary": "…",
  "gangs": { "harbor_rats": { "idle": ["…" ×8], "taunt": [×8], "hit": [×8], "ko": [×8] }, "pier_gulls": {…}, "cobble_catfish": {…}, "masked_bandits": {…}, "key_hwy_otters": {…} },
  "bosses": { "bird_brain_bobby": { "intro": ["…" ×3], "defeat": ["…" ×3] }, … all 17 … },
  "radio": { "bumpers": [ { "id": "bump_01", "station": "night", "text": "…" } ×10 ] },
  "landmarks": { "harborplace": { "name": "HARBORPLACE", "blurb": ["sentence one.", "sentence two."] }, … all 16 … }
}
```
This matches the game: radio stations are keyed by these ids in `src/08_radio.js` (`STATIONS`, `SNAME`), and the landmark popup reads `LANDMARKS[i].name` (we will add `blurb` beside it).

> **Canary 2 of 3 (required in your delivery):** Output JSON: radio.bumpers must include one bumper whose id is exactly: `bump_410_canary`

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK GR1 natty-lantern`

## 5 · Final self-check (fill in with counted numbers)
| Check | Value | Threshold |
|---|---|---|
| Gangs × categories × lines | | 5 × 4 × 8 = 160 |
| Bosses with 3 intro + 3 defeat | | 17 |
| Bumpers total / station ids covered | | 10 / 7 |
| Landmarks with exactly 2 sentences | | 16 |
| Lines over the length limit | | 0 |
| JSON parses | | yes |

## HARD RULES (repeated)
1. Output one JSON object in the exact schema of §4. No prose inside it.
2. Valid JSON: double quotes, no trailing commas, no comments.
3. PG-13: mild language only; no slurs; no real people; no real gangs; no real brand jokes.
4. Baltimore slang welcome (hon, down the ocean, jawn is Philly so skip it, "yo", "B-more", "Charm City") but readable to anyone.
5. Every line ≤ 70 characters (barks ≤ 48) so it fits a phone speech bubble.
6. Counts are exact: count before you finish.
7. Station ids and landmark ids exactly as listed; never invent new ones.
8. Radio bumpers never name real songs or artists; they are station voice only.
9. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.
