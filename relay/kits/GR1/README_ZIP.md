# Toad_City_Round2_GROK.zip
Toad City Baltimore, outside-AI round 2 kit for Grok. Built 11 October 2026 by Hark.

Start with the session prompt you were given (also in `prompts/`). Do its Step 0 comprehension check first.

| ZIP path | What it is |
|---|---|
| `README_ZIP.md` | Index of the ZIP. |
| `reference/radio_stations.js` | The station ids, names and track lists from the game's `src/08_radio.js` (excerpt). |
| `reference/landmarks.js` | The game's `LANDMARKS` list (ids, popup names, bosses) from `src/03_city.js`. |
| `reference/roster.md` | Gangs and the 17 bosses with their approved concepts. |
| `reference/screens/` | Game screenshots for tone. |
| `prompts/` | The GR1 session prompt. |

Node harness setup (from the ZIP root): `npm i` (installs three 0.160.0 from package.json). Browser pages load three r160 from unpkg through an import map.
No credentials, tokens or private data are in this ZIP.
