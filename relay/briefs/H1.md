# H1 · Variation tables: rowhouse combos, store names, street signs
**For:** Claude Haiku · **Setting:** Claude Haiku (newest), extended thinking OFF. · **Depends on:** None. Send any time. · **Delivers: a reply in this chat**

Attach `Toad_City_Round2_HAIKU.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Output only what §4 asks for, in the exact schema. No prose inside the JSON.
2. Valid JSON (RFC 8259): double quotes, no trailing commas, no comments.
3. No real trademarks or brand names unless §3 explicitly lists them as allowed.
4. No duplicates: every entry unique by the field §4 names.
5. Colours are 6-digit hex `#rrggbb`, mid-value (each channel 0x30–0xe8), never pure black or white.
6. PG-13: no slurs, no profanity beyond mild, no real people.
7. If a field's allowed values are listed, use only those values.
8. Count your entries before you finish; the counts are exact, not approximate.
9. Long output: split into numbered parts only if you must; each part valid JSON on its own.
10. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.

## Step 0 · Comprehension check (at the TOP of your reply, then continue straight into the full deliverable in the same reply)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. How many rowhouse combos, store/bar/carryout names and street signs?
   - Q2. Which `brick` index is `br_plum`?
   - Q3. When may `paint` be true?
   - Q4. What is the maximum characters per sign text line?
   - Q5. Which seven cornice colours are allowed?
   - Q6. Which brand names are banned in sign names?
4. **Quote the three canary instructions** this prompt contains (they are marked "Canary 1/2/3 of 3" somewhere in the middle) and confirm you will include each string exactly.

Then continue straight into the full deliverable in this same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed. Brad hands your whole reply to Hark, who checks the Step 0 answers.

## ZIP contents
| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/rowkit/rowkit_rowhouse.js`, `rowkit_corner.js`, `rowkit_tiles.js`, `rowkit_block.js` | The rowhouse kit (Hark's fixed copy) whose overrides and sign boards your tables feed. |
| `reference/rowkit/ALLOWED_VALUES.md` | The override names and allowed values, copied from the code. |
| `reference/lint_targets/` | Round-1 lessons your lint script must catch (Harbor Rats and Task A/B review excerpts). |
| `prompts/` | H1 and H2 session prompts. |

## 1 · Context
Toad City Baltimore is a phone-first cel-shaded brawler on Baltimore's Inner Harbor. The rowhouse kit (built by Sonnet, fixed in-house) draws Baltimore rowhouses, corner stores and street signs procedurally; it reads variation tables to make every block different. You produce those tables.

## 2 · Where helpers fell short last round
Last round's builders guessed values the game could not consume and wrote README numbers nobody measured. For tables that means: every value must match what the kit actually reads (the allowed values below are copied from the kit's code), and every count must be exact.

## 3 · The task: Variation tables: rowhouse combos, store names, street signs
Produce three JSON tables in one JSON object.
1. **`rowhouses`: exactly 200** rowhouse variation combos, each a valid set of the kit's `buildRowhouse` overrides (allowed values below, copied from `rowkit_rowhouse.js`) plus three new colour fields the integration will consume (`trim`, `awning`, `awningStripe`). Make them look like real Baltimore blocks: mostly brick and Formstone, painted brick in pastel trims, a few permastone; cornice colours from the list; awnings on about a third.
2. **`signs`: exactly 120** plausible, **original** corner-store, bar and carryout names in the Baltimore vernacular (e.g. the style of "Charm City Carryout", "Hon's Corner Tavern", "Locust Point Deli"), with the board colours. No real trademarks or existing business names you know of; no brand names (no Natty Boh, Utz, Old Bay, Domino in names). Mix: 50 store, 40 bar, 30 carryout. Text ≤ 16 characters per line so it fits a 4:1 board.
3. **`streets`: exactly 80** street-name signs using **only** the real Inner Harbor / Federal Hill / Fells Point street names listed below (you may repeat a street with a different block number or neighbourhood placement, but each `id` is unique). Block numbers must be plausible hundreds (100–2900).

Allowed street names: Pratt Street, Lombard Street, Light Street, Charles Street, Calvert Street, South Street, Gay Street, President Street, Market Place, Water Street, Redwood Street, Baltimore Street, Fayette Street, Key Highway, Covington Street, Battery Avenue, Hanover Street, Cross Street, Hamburg Street, Montgomery Street, Warren Avenue, Henrietta Street, Riverside Avenue, Fort Avenue, Clement Street, Churchill Street, Grindall Street, Hill Street, Randall Street, Williams Street, Lee Street, Hughes Street, Thames Street, Aliceanna Street, Fleet Street, Eastern Avenue, Broadway, Ann Street, Wolfe Street, Bond Street, Caroline Street, Lancaster Street, Fell Street, Shakespeare Street, Durham Street, Dallas Street, Chester Street, Washington Street, Boston Street, Central Avenue, Exeter Street, Albemarle Street, High Street, Eden Street, Spring Street, Wills Street, Philpot Street, Conway Street, Barre Street, Camden Street, Sharp Street, Howard Street, Eutaw Street, Paca Street.

> **Canary 1 of 3 (required in your delivery):** Output JSON: a top-level key "_canary" whose value is exactly: `tcr2-h1-rowhouse-chalk`

## 4 · Exact schema
```json
{
  "_canary": "…",
  "rowhouses": [
    { "id": "rh001",
      "front": "formstone | brick | permastone",
      "variant": 0,                 // integer 0–3 (formstone uses fs_0..3, permastone ps_0..2 = variant % 3)
      "paint": false,               // true only with front "brick"
      "brick": 0,                   // integer 0–5: 0 br_red, 1 br_tan, 2 br_plum, 3 br_grey, 4 br_green, 5 br_sand (used when front "brick")
      "corniceColor": "#c9b48a",    // one of: #c9b48a #4f5a52 #5a4f5c #8a4a3a #a4907a #9ab0b8 #c49a9a
      "doorColor": 0,               // integer 0–3
      "screens": true,              // painted screens in the ground-floor windows
      "floors": 3,                  // 3 or 4
      "trim": "#c9b48a",            // new: window/door trim colour, mid-value hex
      "awning": null,               // new: null or a mid-value hex
      "awningStripe": null          // new: null or a mid-value hex (only when awning is set)
    }
  ],
  "signs": [
    { "id": "sg001", "kind": "store | bar | carryout", "text": "LOCUST PT DELI", "sub": "COLD CUTS · LOTTO",   // sub ≤ 24 chars or ""
      "bg": "#2f5a3a", "border": "#eae6dc", "ink": "#ffe08a" }       // same three colours the kit's board(bg, border, text, ink) uses
  ],
  "streets": [
    { "id": "st001", "name": "Thames Street", "block": 1600, "neighborhood": "Fells Point | Federal Hill | Inner Harbor | Harbor East | Locust Point" }
  ]
}
```
(The `//` comments above are documentation only: your output must not contain comments.)

> **Canary 2 of 3 (required in your delivery):** Output: the line right before the first JSON block, exactly: `HAIKU-OUT H1 formstone-ledger`

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK H1 thames-lantern`

## 5 · Final self-check (fill in with counted numbers)
| Check | Value | Threshold |
|---|---|---|
| rowhouses count / unique ids | | 200 / 200 |
| signs count by kind (store / bar / carryout) | | 50 / 40 / 30 |
| streets count / names outside the allowed list | | 80 / 0 |
| `paint: true` on a non-brick front | | 0 |
| Colours outside 0x30–0xe8 per channel | | 0 |
| Sign text lines over 16 chars | | 0 |

## HARD RULES (repeated)
1. Output only what §4 asks for, in the exact schema. No prose inside the JSON.
2. Valid JSON (RFC 8259): double quotes, no trailing commas, no comments.
3. No real trademarks or brand names unless §3 explicitly lists them as allowed.
4. No duplicates: every entry unique by the field §4 names.
5. Colours are 6-digit hex `#rrggbb`, mid-value (each channel 0x30–0xe8), never pure black or white.
6. PG-13: no slurs, no profanity beyond mild, no real people.
7. If a field's allowed values are listed, use only those values.
8. Count your entries before you finish; the counts are exact, not approximate.
9. Long output: split into numbered parts only if you must; each part valid JSON on its own.
10. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.
