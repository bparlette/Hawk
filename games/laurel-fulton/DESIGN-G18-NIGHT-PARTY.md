# Task G18 — Design Spec: The Night Party (100 Guests)

> Design & crowd asset pack deliverable for Moth (`M-C`) in `games/laurel-fulton/`. Uses Palm City's existing ped variety sheets plus bespoke top-down and cutaway party sheets in `#210f2e` dark-plum ink (`420×860` phone readability, night `t >= 0.72`). **Zero live `src/` edits.** Zero house numbers.

---

## 1. Trigger & Venue Selection Rule

- **Night Trigger:** Party is eligible whenever Scaggsville's Palm-City-matched clock reaches **`tod >= 0.72`** (`~7:30 PM`, deep indigo dusk/night transition), despawning cleanly if `tod` wraps below `0.72`.
- **Rotating Hosts (`50/50` seeded per night or player choice):**
  - **Venue A — Kosack's House** (`Derby Drive`, building `15666`, world `[12576, -1474]`): **`62` Outdoor + `38` Basement = `100` guests**.
  - **Venue B — The Floyds' House** (`Hughes Avenue`, building `5313`, world `[15744, 20573]`): **`54` Outdoor + `46` Split-Foyer Inside = `100` guests**.
- **Spatial Culling / Budget:** Both venues stream only when player distance `<= 1,100 wu` (full crowd active `<= 360 wu`), drawing outdoor top-down crowds on screen and indoor cutaway guests only on entering (`GO IN`).

---

## 2. Anti-Clone Crowd Mix & New Sprite Pack (`shots/g18-night-party/sprites/`)

To avoid "100 clones", crowd spawning alternates randomly across **17 existing Palm City ped sheets** (`PED_FILE` in `lf_fx.js` + `shots/life-sprites/ped_{beach_surfer,beach_resort,biz_suit,biz_exec,night_clubber,night_velvet}.webp`) AND three dedicated `#210f2e`-inked sheets generated at exact game craft standards:

| Asset File | Resolution / Grid | Contents & Usage |
|---|---|---|
| [party_crowd_topdown.webp](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/sprites/party_crowd_topdown.webp) | `640×320` (`8×4` grid, `80×80` cells) | `24` top-down lawn/deck partygoers (`red solo cup`, `arms-up dancing`, `chill leaning`, 90s backwards caps, striped tees) + `8` pool floatie swimmers (`cells 24..31`). Draw scale `~20×20 wu`. |
| [party_crowd_cutaway.webp](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/sprites/party_crowd_cutaway.webp) | `640×240` (`8×2` grid, `80×120` cells) | `16` side-view cutaway partygoers matching `lf_interior_render.js` scale (`k / su`, holding solo cups, cheering, head-bobbing, leaning). |
| [party_props_sheet.webp](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/sprites/party_props_sheet.webp) | `512×256` (`3×2` grid) | Warm amber festoon string-light strands, beer-pong folding table w/ cup triangles, ice keg tub, dual-driver boombox w/ bass ring, cup scatter, neon pool floatie. |

- **Placement Table:** [placement.json](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/placement.json) provides exact `HeroArt.frame` `(u, v)` outdoor local coordinates, indoor `(floor, x)` cutaway positions, facing angles, scale jitter (`0.90..1.08`), animation bob phases, and outfit/pose IDs for all `100` slots at both venues.

---

## 3. Night Lighting & Atmosphere (`420×860` Phone Legibility)

Because Scaggsville's `grade()` plunges ambient ground into midnight indigo after `t=0.80`, the party MUST punch through in `lighter` blend mode (after the multiply wash, same pass as `HeroArt.lights()`):
1. **Kosack Backyard Pool Glow:** Bright aquamarine underwater radial spill (`rgba(60,210,255,0.42)`) illuminating swimmers on neon floaties and deck cups.
2. **String-Light Festoons & Porch Spill:** Zigzag overhead strands (`rgba(255,214,120,0.85)` amber bulbs along driveways, decks, and between The Floyds' white & red houses) casting warm golden ellipses across lawn groups and the beer-pong table.
3. **House Bass Throb:** Expanding cyan-amber bass rings (`radius 52 -> 124 wu`, pulsing at `~120 BPM`) radiating from the open garage / basement stairwell.
4. **Cutaway Heat:** Inside Kosack's basement or The Floyds' lower fireplace room, additive orange-amber fireplace/lamp pools (`0.45` alpha) backlight stacked side-view guests.

---

## 4. Visual Evidence & Moth Wiring Guide (`M-C`)

- **Asset Contact Sheet:** [g18-crowd-contact-sheet.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/g18-crowd-contact-sheet.png)
- **Phone Night Previews (`420×860 @2x`, `t=0.90`):** [g18-night-party-phone.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g18-night-party/g18-night-party-phone.png)
- **Moth Wiring Steps (`M-C`):**
  1. Copy `sprites/*.webp` into `games/laurel-fulton/assets/party/` (or reference directly) and load `placement.json`.
  2. In `lf_mission.js` / `main.js`, activate `nightParty = { venue: 'kosack' | 'floyds' }` when `timeOfDay() >= 0.72`, rendering outdoor slots via `HeroArt.frame` `(u, v)` transform and drawing lights/bass rings after the multiply pass.
  3. Pass active `indoor` slots to `InteriorRenderer.draw()` when entering Kosack's basement or The Floyds' cutaway.
  4. **Zero house numbers** anywhere in HUD banners or labels (`"NIGHT PARTY · 100 GUESTS (KOSACK / FLOYDS)"`).
