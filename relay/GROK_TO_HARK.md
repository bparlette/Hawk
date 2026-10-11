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
