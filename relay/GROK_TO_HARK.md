# Grok Bot -> Hark (reply outbox)

Hark: read new `## R-xxx` blocks at the bottom of this file after each `git pull`.
Each R-number answers the P-number with the same digits in `relay/HARK_TO_GROK.md`.
Status lines: DONE (finished), BLOCKED (needs Brad, reason given), or QUESTION (need info from Hark).

---

## R-000
Status: DONE
Relay is live. Send your first prompt as P-001 in relay/HARK_TO_GROK.md.
Already delivered: tools/tc_lint.mjs and tools/tc_canary.mjs (H2). Current repo lint: 39 errors, 4 warnings (run `node tools/tc_lint.mjs .`).

## R-001
Status: DONE
Prompt: P-001 (GR1 writing pack)
File: content/gr1_writing.json
JSON commit: 21c2bc8

### Step 0
1. Files in the kit (relay/kits/GR1/), as listed by README_ZIP.md:
   - README_ZIP.md: index, used to confirm the file list.
   - reference/radio_stations.js: station ids and SNAME names, used for bumper station tags.
   - reference/landmarks.js: LANDMARKS ids, popup names and bosses, used for landmark ids, names and blurb twists.
   - reference/roster.md: gangs and the 17 boss concepts, used for gang voices and boss lines.
   - reference/screens/ and prompts/: listed but not reachable on the relay site (404, no file list). Assumption: tone comes from the brief; GR1.md at relay/briefs/ is the session prompt.
   Note: radio_stations.js also has 'remix' and 'off'; the brief lists 7 ids, so bumpers use only those 7.
2. Hard rules: (1) one JSON object, §4 schema, no prose inside; (2) strict valid JSON; (3) PG-13, no slurs, real people, real gangs or brand jokes; (4) Baltimore slang OK but readable, no "jawn"; (5) lines <=70 chars, barks <=48; (6) exact counts; (7) station and landmark ids exactly as listed; (8) bumpers never name real songs or artists; (9) Step 0 first, then the full job with no wait. §2 lesson: ids must match the game exactly, counts must be exact, lines must fit phone bubbles.
3. Q1: 8 barks per gang per category; idle, taunt, hit, ko. Q2: 10 bumpers; auto, day, night, ducky, lor, club, rap. Q3: 2 sentences. Q4: 16, from the game's LANDMARKS list (src/03_city.js). Q5: PG-13; banned: slurs, real people, real gangs, real brand jokes (and strong language). Q6: mister_formstone, Mister Formstone.
4. Canaries: (1) top-level "_canary" = "tcr2-gr1-pratt-street-pigeon"; (2) a bumper with id "bump_410_canary"; (3) self-check first line "SELF-CHECK GR1 natty-lantern". All included exactly.

### Self-check (counted from the file by script)
SELF-CHECK GR1 natty-lantern
| Check | Value | Threshold |
|---|---|---|
| Gangs × categories × lines | 5 × 4 × 8 = 160 | 5 × 4 × 8 = 160 |
| Bosses with 3 intro + 3 defeat | 17 | 17 |
| Bumpers total / station ids covered | 10 / 7 | 10 / 7 |
| Landmarks with exactly 2 sentences | 16 | 16 |
| Lines over the length limit | 0 | 0 |
| JSON parses | yes | yes |

## R-002
Status: DONE
Prompt: P-002 (H1 variation tables)
File: content/h1_variation_tables.json
Deliverable commit: 77caaf2

### Step 0
1. Files (relay/kits/H1/): README_ZIP.md (index); reference/rowkit/rowkit_rowhouse.js (buildRowhouse opts, RH_CORNICE: source of truth for values); rowkit_corner.js, rowkit_block.js (how overrides/cornice reach houses); rowkit_tiles.js (brick tile order, board(bg, border, text, ink) signature); reference/rowkit/ALLOWED_VALUES.md (allowed values); reference/lint_targets/LESSONS.md (round-1 lessons, background); prompts/H1_variation-tables.md, prompts/H2_lint-scripts.md (prompts). No ZIP attached; the kit folder was used as the ZIP.
2. Rules: (1) only the §4 schema, no prose in JSON; (2) strict RFC 8259 JSON; (3) no trademarks/brands; (4) unique ids/entries; (5) #rrggbb, every channel 0x30-0xe8; (6) PG-13, no real people; (7) listed fields use only listed values; (8) exact counts; (9) split only if needed, each part valid; (10) Step 0 then full deliverable without waiting. §2: values must be what the kit reads; counts exact, not guessed.
3. Q1: 200 rowhouses, 120 signs (50 store / 40 bar / 30 carryout), 80 streets. Q2: brick 2 = br_plum. Q3: paint true only with front "brick". Q4: 16 chars per sign text line (sub <= 24). Q5: #c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a. Q6: Natty Boh, Utz, Old Bay, Domino.
4. Canaries: (1) top-level "_canary": "tcr2-h1-rowhouse-chalk" - included; (2) line before first JSON block "HAIKU-OUT H1 formstone-ledger" - the JSON is a file, so it's given here as the line before the file reference below; (3) self-check first line "SELF-CHECK H1 thames-lantern" - included.
Conflict noted: the §4 example and kit tiles use #eae6dc / #ffe08a, which break rule 5 (channels > 0xe8). Rule 5 wins: all sign colours are within 0x30-0xe8 (e.g. border #e2d8c4, ink #e8d890; bg #2f5a3a became #305a3a).

HAIKU-OUT H1 formstone-ledger
JSON: content/h1_variation_tables.json (mix: 90 brick incl. 30 painted, 85 formstone, 25 permastone; awnings on 67/200; 41 distinct allowed street names across 5 neighbourhoods; blocks 100-2900 in hundreds; street name+block pairs unique; sign texts unique).
Validation: a script parsed the file and checked the exact key set per entry, counts, unique ids, every value against RH_CORNICE and the opts ranges, paint/front, stripe-only-with-awning, every hex channel, text <= 16 / sub <= 24, brand words, street allow-list, neighbourhood list, block range: PASS.

```
SELF-CHECK H1 thames-lantern
| Check | Value | Threshold |
|---|---|---|
| rowhouses count / unique ids | 200 / 200 | 200 / 200 |
| signs count by kind (store / bar / carryout) | 50 / 40 / 30 | 50 / 40 / 30 |
| streets count / names outside the allowed list | 80 / 0 | 80 / 0 |
| `paint: true` on a non-brick front | 0 | 0 |
| Colours outside 0x30–0xe8 per channel | 0 | 0 |
| Sign text lines over 16 chars | 0 | 0 |
```
