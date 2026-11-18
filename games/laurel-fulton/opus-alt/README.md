# Opus alt — convoy racing, Kosack's fake cop, the night party (for side-by-side review)

The owner asked for **both** versions to be checked in so the reviewers can pick. Nothing here replaces Moth's version, which
is live in the main game.

| | Moth's (live) | Opus alt (this folder) |
|---|---|---|
| Play | [`play.html`](../play.html) | [`play-opus-alt.html`](../play-opus-alt.html) |
| Code | Hawk a36d81ed — M-A convoy mischief, M-B Kosack fake-cop, M-C 100-guest night party | `opus-alt/src/` — `lf_convoy.js`, `lf_barks.js`, `lf_copgame.js`, `lf_party.js` (+ small hooks in `lf_mission`, `lf_render`, `main`) |
| Proof | Moth's shots in `shots/all-in-verify/` | `node opus-alt/tools/spec_convoy.mjs` · `spec_copgame.mjs` · `spec_party.mjs` (all OK); shots `shots/convoy-*`, `shots/copgame-*`, `shots/party-*` |

**What the Opus alt does:**
- **Convoy (owner, Nov 18):** followers race to pass you and drop back on the real roads. Barks go up: "Cole Trickle", and "rubbin is racing" when they bump you. Ones flutter out the windows at other cars, and pens and pennies arc between convoy cars.
- **Kosack's cop lights:** an always-on red/blue light bar on his Cavalier.
- **Fake-cop mini-game:** lights and the siren (Palm City's siren recipe). Sit close behind a car long enough and it slows and pulls to the kerb.
- **Night party:** about 100 Palm City peds at Kosack's (yard and pool) or the Floyds', with music rings.

**Caveat for a fair comparison:** this folder is a SNAPSHOT of the Opus agent's branch, built on Hawk 26f81381 (morning of Nov 18). It runs on the current map data, but it does **not** include work that landed after that point:
- L11 hero homes;
- Weis and Gringada;
- Brad's and Rigg's extras;
- Kosack's interior;
- the Nov 18 rally fixes.

Judge it only on the three features. Whichever wins gets ported onto the current code.
