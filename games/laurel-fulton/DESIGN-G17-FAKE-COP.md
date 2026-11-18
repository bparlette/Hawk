# Task G17 — Design Spec: Kosack's Fake-Cop Pull-Over Minigame

> Design-only deliverable for Moth (`M-B`) in `games/laurel-fulton/`. Inherits Palm City's `#210f2e` dark-plum ink language, `render.js` additive glow cones, `audio.js` WebAudio siren synth, and `lf_render.js` HUD pills at `420×860`. **Zero live `src/` edits.** Zero house numbers.

---

## 1. Core Fantasy & Standing Rules

- **You are NOT a cop.** Brian Kosack's red 1996 Chevrolet Cavalier sedan (`cavalier_kosack` on Derby Drive) **always** has fake windshield/dash cop lights flashing — parked, driven by CPU, or driven by you (`fx: ['cop_lights']` in `data/roster.json`).
- **No tickets, no wanted authority, no arrests:** You have zero badges and zero legal authority. The comedy is purely flashing lights + loud fake siren + seeing who actually pulls over before realizing it's a kid in a Cavalier.
- **Availability:** Active whenever you are driving `cavalier_kosack` (either picked Kosack or jacked/swapped into his Cavalier on Derby Drive or in the rally). Outside `cavalier_kosack`, the Cavalier retains its always-on flashing dash lights as an unmistakable rolling prop.

---

## 2. Visual Light Pattern (`lf_render.js` / `lf_fx.js` Hook)

1. **Always-On Windshield Visor & Dash Strobe (`cavalier_kosack`):**
   - Rendered in `drawGlow(g, c)` whenever `fxOf(S, c).includes('cop_lights')` (active day & night, stronger bloom at dusk `gr.heads`).
   - **Cadence (`6.4 Hz` alternating wig-wag):** Left windshield quadrant flashes **Red (`#ff2e38`)**, right quadrant flashes **Blue (`#3882ff`)**, alternating strictly out-of-phase (`phase = Math.floor(time * 6.4) % 2`) with a quick double-strobe blink every 4th beat (`(tick % 8) < 2`) so it reads unmistakably as aftermarket fake-cop strobes at phone scale (`420×860`).
   - **Windshield Deck Rectangles + Hood Wash:** Two `7×4 wu` bright core bulbs seated just behind the Cavalier's front windshield edge casting an alternating red/blue `globalCompositeOperation = 'lighter'` hood reflection (`radius = 22 wu`).
2. **Alternating Red/Blue Forward Headlight Cones:**
   - Uses the exact gradient cone geometry of `drawGlow(g, c)` (`beamL = L * 2.6`, `beamW = Wd * 0.95`):
   - Left bulb alternates warm-white (`rgba(255,240,200, ...)`) <-> crisp Red (`rgba(255,46,56, 0.72 * hf)`), right bulb alternates warm-white <-> electric Blue (`rgba(56,130,255, 0.75 * hf)`).
   - **Ambient Asphalt Halo:** Subtle pulsing red-or-blue ellipse (`L * 0.85`) washing onto the asphalt ahead of the bumper so it contrasts sharply against Rigg's steady blue beam and Brad's steady yellow beam.

---

## 3. Siren Sound Design (Extending Palm City `src/audio.js`)

Reuses `Audio`'s WebAudio `triangle` + LFO pattern (`palm-city/src/audio.js:47-55`), adding a dedicated `fakeSiren` voice gated by player input (`HONK` / `Space` / Action button while driving Kosack's Cavalier):
- **Tap `HONK` (`< 0.35 s`):** Short **`WOOP-WOOP` air-horn blip** — two `110 ms` upward frequency chirps (`620 Hz -> 980 Hz` sawtooth through a `1100 Hz` bandpass + `35 ms` white-noise PA crackle burst on release).
- **Hold / Active Pull-Over (`>= 0.35 s` or chasing a locked target):** Continuous **two-tone wail <-> yelp toggle**:
  - Sweeps **`620 Hz <-> 980 Hz`** (`center = 800 Hz, depth = 180 Hz`).
  - LFO rate switches from slow highway **Wail (`0.9 Hz`)** to urgent **Yelp (`3.4 Hz`)** once a target car enters `HESITATE` lock!
- Volume attenuates smoothly when off-player; completely distinct from Palm City's `760 Hz ± 180 Hz` cruiser siren so friends nearby know it's Kosack.

---

## 4. Pull-Over State Machine & Target Car Reactions

A target NPC/traffic car within **`140 wu`** ahead of `cavalier_kosack` (inside a **`±28°`** forward cone while `sirenActive || chasingBehind`) enters the state machine:

| State | Duration / Threshold | Target Driving Behaviour & HUD Cue |
|---|---|---|
| `NONE` | Outside `140 wu` or > 30° off nose | Normal lane traffic cruise (`stepTraffic` / route speed). |
| `HESITATE` | `0.0 -> 1.4 s` | Target brakes smoothly (`0.55×` cruise), flashes brake lights, slightly weaves (`±2 wu`) while checking mirrors. **Lock Ring** fills around target car (`#ff2e38` / `#3882ff` dashed arc, filling clockwise to `100%`). Dropping out of `185 wu` cancels lock cleanly. |
| `PULL_OVER` *(70% odds)* | Holds stopped for **`5.0 s`** | Target signals right (`amber` blinker pulse), steers onto kerb/shoulder (`latOff = +r.hw - 4`), stops completely (`v = 0`), hazard flashers blink. **Kosack pulls alongside or behind -> Comedy Exchange triggers (`1.8 s` apart) + Score Toast!** |
| `PEEL_OFF` *(30% odds)* | `3.5 s` escape cooldown | Driver spots the Cavalier headlights & laughs it off: **double-honks**, pops white tire smoke puff, boosts to **`1.35×`** speed for `3.5 s` and peels away! Player still earns **`+100 BUSTED BLUFF`** style bonus (never punitive). |

*(All `PULL_OVER` / `PEEL_OFF` targets carry a `25 s` per-car cooldown so you can't farm the exact same car twice in a row.)*

---

## 5. Score, Streak & HUD Feedback (`420×860` Phone Scale)

- **Points & Streak Multiplier:**
  - Successful Fake Pull-Over: **`+250 FAKE STOP`** × Streak (`×1`, `×2`, `×3`, max `×4` = **`+1,000`** within `18 s` between stops).
  - Driver Calls Your Bluff (`PEEL_OFF`): **`+100 BUSTED BLUFF`** (resets streak cleanly, keeps the laugh moving).
- **HUD Toast Card (`VIEW_W / 2`, `y = 112`):** `#210f2e` dark-plum inked capsule (`rgba(27,20,48,0.88)` fill, alternating `#ff2e38`/`#3882ff` left/right neon end-caps, `GOLD #ffd25c` score text e.g. **`+500 FAKE STOP · STREAK ×2`**).
- **Zero Wanted Escalation Guarantee:** Pulling someone over adds **0 stars** — unless you physically ram them hard enough to trigger normal crash damage.

---

## 6. Comedy Barks (`10` Lines — `<= 10` Words Each)

Speech pills render over the speakers using `lf_render.js` warm cream capsules (`rgba(255,241,216,0.95)`, `#210f2e` border) above Kosack's Cavalier and the target roof.

### Kosack (`5` Lines, PA-Style)
1. `"Pull it over, buddy! ...Nah, I'm messing with ya!"` *(8 words)*
2. `"Step out the vehicle — wait, got any ones?"` *(8 words)*
3. `"Sir, you were doing forty in a Cavalier zone."` *(9 words)*
4. `"Relax, I'm not a cop. Cool car though."` *(8 words)*
5. `"Don't tell nobody, I'm late to Atholton anyway."` *(8 words)*

### Pulled-Over & Peel-Off Drivers (`5` Lines)
1. `"Wait... you're seventeen in a red Cavalier?!"` *(7 words)*
2. `"Man, I hid my stash for THAT?!"` *(7 words)*
3. `"Officer—hold up, I went to school with you!"` *(9 words)*
4. `"Bro, that's a RadioShack visor light! Later!"` *(7 words)* *(peel-off)*
5. `"Nice try, Kosack! See you at Ledo!"` *(7 words)* *(peel-off)*

---

## 7. Acceptance Evidence & Moth Wiring Hook (`M-B`)

- **Storyboard Mockup:** [g17-fakecop-phone.png](file:///Users/braidpairlette/Games/Hawk/games/laurel-fulton/shots/g17-fake-cop/g17-fakecop-phone.png)
- **Moth Wiring Notes (`M-B`):**
  1. Add `'cop_lights'` to `cavalier_kosack` in `data/roster.json` `fx` array and draw the `6.4 Hz` alternating red/blue visor + cone bloom in `src/lf_render.js` `drawGlow()`.
  2. Wire `fakeSiren` onto `Action`/`Honk` inside `cavalier_kosack` using `620–980 Hz` WebAudio toggle, plus a lightweight `lf_fakecop.js` module managing `HESITATE` / `PULL_OVER` / `PEEL_OFF` states on nearby non-crew traffic cars.
