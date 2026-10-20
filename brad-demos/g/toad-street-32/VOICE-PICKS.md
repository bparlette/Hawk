# Toad Street 32 — HOA Warfare voice picks

**Game:** `brad-demos/g/toad-street-32/` (bparlette/Hawk) — chunky 32-bit Three.js
beat-em-up: **Harold** (elderly toad, player-controlled) + **Mavis** (his wife,
AI partner, grey afro, floral dress, pearls, handbag) vs **five thugs** on one
street block. Endless brawler — thugs respawn after 14s; game over only when
both turtles are KO'd.

**Voices:** `bparlette/hoa-warfare` voice manifest (`web/vo/manifest.json`,
1394 lines). Audio streams from jsDelivr —
`https://cdn.jsdelivr.net/gh/bparlette/hoa-warfare@main/web/vo/<file>`
(binaries must never go through the GitHub connector — it corrupts them).

## Casting

| Character | HOA voice | Voice model | Why |
|---|---|---|---|
| **Harold** (player) | **pickleballRetirees** | `avocado_v2:vdc_22255` @ 0.8 pitch, 1.25 rate | The feisty-retiree voice. An elderly brawler saying "Let's finish before dinner" before fighting thugs is the whole joke of this game. 9 lines. |
| **Mavis** (AI partner) | **karens** | `avocado_v2:Karen` @ 1.25 pitch, 1.25 rate | The iconic Call of Karen voice. A handbag-wielding wife shouting "I want to speak to your MANAGER!" while bonking thugs is comedy gold, and it's the franchise voice Cherie asked for. 5 lines. |

## Line list (14) with trigger events

All triggers are detected by polling `window.__cel` (exposed by game.js —
`S`, `PART`, `CINE`, `enemies`, `hero`). No game.js edits needed.

| # | Who | Line | File | Trigger (game event) |
|---|---|---|---|---|
| 1 | Harold | "Let's finish before dinner." | `pickleballRetirees_roundStart_s_0.ogg` | Fight start — intro cinematic ends (or ~1.5s in with `?nointro=1`). 50/50 alternate with Mavis's opener. |
| 2 | Mavis | "Let's get this sorted!" | `karens_roundStart_c_0.ogg` | Fight start (alternate). |
| 3 | Harold | "First blood! Before noon!" | `pickleballRetirees_firstBlood_c_0.ogg` | First thug KO of the session (`S.kills` 0→1). |
| 4 | Harold | "Early-bird special: you're dead." | `pickleballRetirees_kill_s_0.ogg` | Thug KO'd by Harold (`PART.heroKos` increments). 8s cooldown. |
| 5 | Mavis | "I want to speak to your MANAGER!" | `karens_kill_c_0.ogg` | Thug KO'd by Mavis (`PART.kos` increments). 8s cooldown. |
| 6 | Harold | "Backhand of justice!" | `pickleballRetirees_melee_c_1.ogg` | QTE finisher lands (`CINE.stats.finishers` increments). 10s cooldown. |
| 7 | Harold | "Double kill. Still got it." | `pickleballRetirees_double_s_0.ogg` | Combo crosses 5 (`S.combo`). 15s cooldown. |
| 8 | Harold | "Bleeding? That's just arthritis." | `pickleballRetirees_lowHealth_s_0.ogg` | Harold HP drops below 30 (re-arms above 60). 25s cooldown. |
| 9 | Harold | "Medicare won't cover that burn." | `pickleballRetirees_humiliated_s_0.ogg` | Harold knocked down (`S.playerDowns` increments). 10s cooldown. |
| 10 | Mavis | "This is UNACCEPTABLE." | `karens_humiliated_c_0.ogg` | Mavis knocked down (`PART.downs` increments). 10s cooldown. |
| 11 | Harold | "We won! Early-bird dinner's on me!" | `pickleballRetirees_victory_c_0.ogg` | Street cleared — all 5 thugs down at once. 50/50 with Mavis's. 45s cooldown. |
| 12 | Mavis | "Motion PASSES. I win." | `karens_victory_c_0.ogg` | Street cleared (alternate). |
| 13 | Harold | "Lost. My knee knew first." | `pickleballRetirees_defeat_s_0.ogg` | GAME OVER — both turtles KO'd (`PART.over`). 50/50 with Mavis's. 45s cooldown. |
| 14 | Mavis | "I'm filing an APPEAL." | `karens_defeat_c_0.ogg` | GAME OVER (alternate). |

**Playback rules** (in `voice.js`): one voice at a time — if a line is playing,
new triggers are skipped, never overlapped or queued. All 14 preload on the
first pointer/key/touch gesture (autoplay-safe). `?novoice=1` disables the pack.
`window.ToadVoice.say(key)` allows manual triggering from the console.

## Rejected factions / lines (and why)

- **hoaDads** — dad-voice could suit Harold, but pickleballRetirees is a
  tighter match: the lines are *about being old* ("My knee knew first",
  "That's just arthritis"), which is the entire Harold/Mavis joke. hoaDads
  lines lean suburban-dad, not elderly-brawler.
- **rednecks / gymRats** — considered for the five thugs (spawn taunts), but
  the thugs are mute heavies in the current design and 14 lines already cover
  every game event. Thug voices are the obvious v2 addition.
- **tradwives / valleyGirls / animeWeebs / furries / wokeLibs / trumpers /
  cloutStreamers / brainRot / fabulous / wallstreetBets / fratHouse** — wrong
  age, wrong energy, or too HOA-lore-specific for an elderly toad couple.
- **Cut factions (Old Money, Emo Kids, MLM Huns, Theater Kids)** — excluded per
  the brief; not in the manifest anyway.
- **HOA-lore lines** — rejected any line referencing HOA business, even from the
  picked factions: "Kitchen violation. You're done.", "Noise complaint filed.
  You're evicted.", "Read the bylaws, LOSERS.", "I OWN this neighborhood.",
  "Your lawn has a LIEN now!", "Dinked! Stay outta the kitchen!" — these would
  confuse in a game with no HOA. (One exception: "Motion PASSES. I win." kept
  for Mavis — it reads as a generic meeting joke, not HOA-specific.)
- **karens "This is why your husband left!"** — funny but mean-spirited toward
  Mavis herself; cut on tone.

## Wiring (for the push)

One-line change to `brad-demos/g/toad-street-32/index.html` — add after the
game.js script tag:

```html
<script type="module" src="game.js"></script>
<script type="module" src="voice.js"></script>
```

(`type="module"` matters: modules execute in document order, so `voice.js`
runs after game.js has set `window.__cel`. A classic script would run first
and find nothing. `voice.js` also polls defensively.)

## Files in this folder

- `voice.js` — the voice pack (drop into `brad-demos/g/toad-street-32/`)
- `VOICE-PICKS.md` — this doc

## Testing notes (not yet run)

- Open `index.html` (or `?bot=1` autopilot) and confirm: opener line at fight
  start, kill lines on KOs with correct Harold/Mavis attribution, "GAME OVER"
  defeat line when both turtles drop, no overlapping voices during a brawl.
- Network: first visit fetches up to 14 small oggs from jsDelivr on first
  gesture; check DevTools for 404s (filenames verified against
  `hoa-warfare/web/vo/` on 2026-10-20 — all 14 exist).
- Cherie's content rules respected: no slurs, no "gay", no HOA-lore lines.
