# Palm City — Jobs & Events UI Art Usage Note (`games/palm-city/shots/ui-art/`)

**Audit Note:** Checked `src/hud.js`, `src/jobs.js`, `assets/`, and `shots/` prior to creation. Fable's `hud.js` (`L156–188`) draws a flat translucent `roundRect` (`190×52` view units) and a `5 px` mood bar for active jobs, while `WRECK IT!` score plates, `VALET` rating cards, fare-mood portraits, and event medals do not yet have UI sprite assets. All `17` transparent WebPs below export at **Retina `@2x`** (`0.5×` draw scale on the `420×860` phone viewport) with `#210f2e` dark-plum contours and high-contrast fill gradients.

**Generator script:** `node games/palm-city/tools/build_ui_art.mjs` (`cwebp -q 92 -alpha_q 100`)

## Asset Specs & `hud.js` Drop-In Placement

| Category | Files | Pixels (`@2x`) | Draw Size (`vu`) | Integration & Text Safe Zones |
|---|---|---:|---:|---|
| **Job Cards** | `job_card_{taxi,tow,bus,getaway}.webp` | `380 × 104` | `190 × 52` | Replace the flat `roundRect` in `hud.js:158` at `(vw/2 - 95, top + 62)`. Left `42 vu` holds the emblem/accent bar; keep title/objective text aligned at `x + 48`, right timer at `x + 178`. `bus` top dots track `stop / 6`. |
| **Fare Moods** | `mood_{chill,nervous,panic,fed}.webp` | `64 × 64` | `32 × 32` | Render beside the right edge of `job_card_taxi` (`x + 196, y + 10`) mapped from `fare.mood` (`> 0.6` chill, `0.25..0.6` nervous, `< 0.25` panic) and `fare.fed && fare.revealed` (`fed`). |
| **WRECK IT! Score & Combo** | `wreck_score_banner.webp`, `wreck_combo_badge.webp` | `440 × 120`, `160 × 96` | `220 × 60`, `80 × 48` | Anchor score plate center-top or lower-center (`y = top + 62`); overlay numeric score at `(x + 18, y + 44)` (`18 pt` bold `#fff9ee`). Float tilted combo badge on top-right corner during `>= 2x` chains. |
| **Event Medals** | `medal_{bronze,silver,gold}.webp` | `96 × 96` | `48 × 48` | End-of-round summary & threshold progress indicator (`Bronze / Silver / Gold` tiers). |
| **VALET Rating Cards** | `valet_card_{mint,drift,jturn,scrape}.webp` | `360 × 160` | `180 × 80` | Timed toast card (`1.6 s`) when locking a valet stall: `Mint Park` (`0` scuffs), `Drift Bay` (`2.5x`), `180° J-Turn` (`5x`), or `Scraped!` (`-50%` tip penalty). |

Preview at native phone scale: [ui-art-phone-sheet.png](ui-art-phone-sheet.png)
