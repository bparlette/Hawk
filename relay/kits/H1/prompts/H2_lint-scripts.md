# H2 · Delivery lint and canary-check scripts
**For:** Claude Haiku · **Setting:** Claude Haiku (newest), extended thinking OFF. · **Depends on:** None. Send any time. · **Delivers: a reply in this chat**

Attach `Toad_City_Round2_HAIKU.zip` to this chat together with this prompt. Everything bulky (code, references, renders) is in the ZIP; this prompt names the files.

## HARD RULES (read first; repeated at the very end)
1. Output only the two scripts §3 asks for, plus one example run each.
2. Node 18+ ES modules, zero npm dependencies, each script ≤ 150 lines.
3. Never print the expected-strings file except inside per-string result lines.
4. Every finding names file and line.
5. Error-level findings exit with the code §3 names; warnings never change the exit code.
6. No regex lookbehind; no network access; read-only on the scanned folder.
7. Comment every check with the round-1 bug it catches.
8. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.

## Step 0 · Comprehension check (at the TOP of your reply, then continue straight into the full deliverable in the same reply)
1. **List every file in the ZIP** (full path) and say in a few words what you will use it for.
2. **Restate, numbered and in your own words, every HARD RULE above and every lesson or fix row in §2** (one line each).
3. **Answer these questions.** Every answer is in the sections below; quote the exact number, name or code.
   - Q1. Which options-object pattern must `tc_lint.mjs` flag?
   - Q2. What cache key is wrong, and what should it be?
   - Q3. What exit code on an error-level finding?
   - Q4. Maximum length per script?
   - Q5. Which README words next to a number must be flagged?
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

## 3 · The task: Delivery lint and canary-check scripts
Write two small dependency-free Node scripts (Node 18+, ES modules, no npm packages) that Hark runs on every delivery folder:
1. **`tc_lint.mjs <folder>`**: walks `<folder>/src/*.js` and reports, per file, with line numbers: any `import` statement; `Math.random(`; `new THREE.Mesh*Material` / `MeshStandardMaterial` / `MeshPhysicalMaterial`; `PointLight` / `SpotLight` / `DirectionalLight`; `TextureLoader` / `GLTFLoader` / `fetch(` / `http`; `frustumCulled = false`; a `{ … outline: false … }` options object on the same line without `shadow: false`; a bare `export const META ` (should be `META_<NAME>` for environment modules: warn only); a module-level `WeakMap`/`Map` cache whose `.get(`/`.has(` key is exactly `K` (should be `K.QUAL || K.THREE || K`); README lines in `<folder>/README*.md` containing "about", "approx", "~" next to a number. Exit code 1 on any error-level finding. Output a markdown table.
2. **`tc_canary.mjs <folder> <strings.txt>`**: reads one expected string per line from `strings.txt` (Brad keeps it privately) and reports, per string, FOUND (with file:line) or MISSING, searching every text file in the folder (`.js .md .json .html .txt`). Never prints the strings file contents except in the result lines.
Both scripts ≤ 150 lines each, commented, no regex lookbehind (Safari-safe habits).

> **Canary 1 of 3 (required in your delivery):** tc_lint.mjs: line 1, exactly: `// _canary: tcr2-h2-lint-oyster`

## 4 · Exact schema
Deliver two code blocks titled `tc_lint.mjs` and `tc_canary.mjs`, then one example run output for each on an imaginary folder. No JSON schema: the canary JSON key rule becomes a comment line `// _canary: <value>` as line 1 of `tc_lint.mjs`.

> **Canary 2 of 3 (required in your delivery):** Output: the line right before the tc_lint.mjs code block, exactly: `HAIKU-OUT H2 canary-crab`

> **Canary 3 of 3 (required in your delivery):** Final message: the first line of the filled self-check block, exactly: `SELF-CHECK H2 lint-lantern`

## 5 · Final self-check (fill in with counted numbers)
| Check | Value | Threshold |
|---|---|---|
| tc_lint.mjs lines | | ≤ 150 |
| tc_canary.mjs lines | | ≤ 150 |
| npm dependencies | | 0 |
| Patterns covered from §3 list | | all 11 |

## HARD RULES (repeated)
1. Output only the two scripts §3 asks for, plus one example run each.
2. Node 18+ ES modules, zero npm dependencies, each script ≤ 150 lines.
3. Never print the expected-strings file except inside per-string result lines.
4. Every finding names file and line.
5. Error-level findings exit with the code §3 names; warnings never change the exit code.
6. No regex lookbehind; no network access; read-only on the scanned folder.
7. Comment every check with the round-1 bug it catches.
8. Answer the Step 0 comprehension check at the top of your reply, then continue straight into the full deliverable in the same reply; do not wait for GO. If any Step 0 answer reveals a conflict or a missing file, state your assumption and proceed.
