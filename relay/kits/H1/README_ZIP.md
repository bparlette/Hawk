# Toad_City_Round2_HAIKU.zip
Toad City Baltimore, outside-AI round 2 kit for Claude Haiku. Built 11 October 2026 by Hark.

Start with the session prompt you were given (also in `prompts/`). Do its Step 0 comprehension check first.

| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/rowkit/rowkit_rowhouse.js`, `rowkit_corner.js`, `rowkit_tiles.js`, `rowkit_block.js` | The rowhouse kit (Hark's fixed copy) whose overrides and sign boards your tables feed. |
| `reference/rowkit/ALLOWED_VALUES.md` | The override names and allowed values, copied from the code. |
| `reference/lint_targets/` | Round-1 lessons your lint script must catch (Harbor Rats and Task A/B review excerpts). |
| `prompts/` | H1 and H2 session prompts. |

Node harness setup (from the ZIP root): `npm i` (installs three 0.160.0 from package.json). Browser pages load three r160 from unpkg through an import map.
No credentials, tokens or private data are in this ZIP.
