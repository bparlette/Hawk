# G10 · Integration QA, 7 boss modes (P-014)

QA-REPORT G3 method. Reviewed `review/integration` at 5f3b4de5cf21d53da286cbc34616158d0dfde6ea in a temporary detached worktree (branch not modified). Judged against README.md. Not run in a browser; the new 390×844 screenshots in site/home/*_390.png (780×1688 @2x) were used as measured evidence.

## Intake
- I3 Branch/commit: `review/integration` → 5f3b4de. Y
- **Delta since G8 (2a07156):** `git diff --quiet 2a07156 5f3b4de -- src site/game.js README.md` exits 0. **The game code, the bundle and README are byte-identical to what G8 reviewed.** The only new commits are da11632 and 5f3b4de: 37 files under site/home/ (homepage, homepage radio, 7 mode screenshots, landmark art). The homepage is out of scope for P-014, apart from using its screenshots as evidence.
- The ZIP, kit, lint and preview intake lines are n/a (source branch).

## Totals: 22 findings · 0 blocker · 5 major · 17 minor
19 are carried over from G8 and still open, 1 G8 item is closed by evidence (G8 #20, except Vic), and 3 are new from the screenshots.

## G8 findings: status at 5f3b4de
All file:line cites in content/g8_integration_qa.md still apply, because the code is identical.

| G8 # | Sev | Finding (short) | Status |
|---|---|---|---|
| 1 | major | No mode reads content/gr3_mode_writing.json (0 hits) | OPEN |
| 2 | major | Fort ✕ during the win anthem calls leave(false) and skips BOSS_CLEAR (09_fort.js:82, :540) | OPEN |
| 3 | major | Fort ✕ is 30×30 px (09_fort.js:58); the screenshot shows it about 60 px wide at 2x in fort_rockets_390.png | OPEN (measured) |
| 4 | major | Derby QUIT is about 27 px tall (06g_derby.js:319); it reads small in bobby_derby_390.png | OPEN |
| 5 | major | Derby, racers and duels duck the radio via setVolume, which iOS ignores (08_radio.js:276, :289) | OPEN, UNVERIFIED on device |
| 6 | minor | Fort end-card buttons about 31 px (09_fort.js:61) | OPEN |
| 7 | minor | Vic card buttons about 35 px (06v_vic_rhythm.js:64) | OPEN |
| 8 | minor | Duel over-screen buttons about 42 px (09a_duel_core.js:54) | OPEN |
| 9 | minor | No mid-song exit in Vic (06v_vic_rhythm.js:419) | OPEN |
| 10 | minor | `RB.alStats.cleared` is always true (06h_racers.js:438, 06g0_boss_clear.js:19) | OPEN |
| 11 | minor | Duchess hand-rolls the clear event with lm:null (06h_racers.js:712-714) | OPEN |
| 12 | minor | Vic's duplicate stand-in bossClear is dead code (06v_vic_rhythm.js:42-50) | OPEN |
| 13 | minor | `?rbfresh=1` wipes all saves in the shipped build (06h_racers.js:18) | OPEN |
| 14 | minor | Test globals and URL starters ship live (`__fort`, `__derby`, `__duels`, `__rb`, `__vic`) | OPEN |
| 15 | minor | Vic `setInterval(schedTick, 25)` runs forever (06v_vic_rhythm.js:199) | OPEN |
| 16 | minor | `FORT.world()` runs during duels and racers (07_main.js:157) | OPEN, UNVERIFIED |
| 17 | minor | `__cel.pause` can't pause derby, Vic, the map or the fort (07_main.js:153-158) | OPEN |
| 18 | minor | Shared DUCK.k always restores to 1 (08_radio.js:288-289) | OPEN, UNVERIFIED |
| 19 | minor | Full map `open()` returns undefined vs false (07b_fullmap.js:188-189) | OPEN |
| 20 | minor | Phone HUD overlap at 390×844 with the radio ticker | **CLOSED for 6 modes by evidence**: in fort_rockets, bobby_derby, jimmy_swim, chipkid_duel, al_chase and duchess_ram _390.png the ticker sits above every HUD bar with no overlap (the fort shows no ticker because the radio is held). Vic is still open; see N1. |

Fixed: 0. Still open: 19. Closed by new evidence: 1 (G8 #20, except Vic).

## New findings (from the 390×844 screenshots)
- **N1 · MINOR · Vic · top HUD legibility.** In vic_rhythm_390.png at y ≈ 95-135 px (2x), the "VOLTAGE VIC" title and the "PHASE 1/3 · DANCE MY PAIN AWAY" label sit on top of a large glowing background word and the HP bar edge, so the title is hard to read. Fix: give the label row a dark backing strip or move the background word below y 70 CSS px. UNVERIFIED on other phones and phases; need phase 2/3 shots.
- **N2 · MINOR · content · explicit track title in the radio ticker over a boss mode.** bobby_derby_390.png shows the ticker during the derby reading "…Whores in This House · Frank Ski". The ticker stays visible over 5 of the 7 modes (derby, both duels, Al, Duchess; Vic shows its own lent credit). Only the duck applies, not a hold, so station titles keep scrolling. That's a rating and tone choice for Brad: filter explicit titles from the ticker, or hold the radio in modes. Source: the radio track list in src/08_radio.js (`TRACKS`); exact line UNVERIFIED.
- **N3 · MINOR · originality (G3 B4 / G7) · Chip Kid mech packaging.** chipkid_duel_390.png shows the mech's bag printed "LIL' CRUNCH · CRAB CHIPS · CHESAPEAKE CRAB SPICE · NET WT 99 OZ". The name is original, but crab-spice chips in a red bag read close to real regional chip brands, and "crab" is on the writing ban list. Suggest renaming to a non-crab flavor (e.g. "HARBOR SEASONING"). Rig source is in 09c_chipkid.js (the canvas label); exact line UNVERIFIED.

## Per mode (checks 1–4)
Everything in G8 still holds; the code is unchanged.
- **Fort Bombardment:** win and lose both reachable (09_fort.js:517-532, :628). Exit is clean except G8 #2. Phone issues are G8 #3 and #6.
- **Bobby derby:** win and lose reachable (06g_derby.js:522). Exit is clean (:435-440). Phone issue is G8 #4. Content issue is N2.
- **Big Jimmy swim:** win and lose reachable (09b_jimmy.js:271-274). Exit is clean (09a_duel_core.js:168-179). Phone issue is G8 #8. The HUD is clear in jimmy_swim_390.png.
- **Chip Kid duel:** win and lose reachable (09c_chipkid.js:200, :297-298). Exit is clean. Phone issue is G8 #8. Originality issue is N3.
- **Arabber Al chase:** win and lose reachable (06h_racers.js:511, :453). Exit is clean (:431-434). Retry buttons about 44 px are OK. Finding: G8 #10.
- **Duchess ram:** win and lose reachable (06h_racers.js:779, :801). Exit is clean (:706-709). Finding: G8 #11.
- **Vic rhythm battle:** win and lose reachable (06v_vic_rhythm.js:344, :389, :398). Exit is clean (:362-367). Findings: G8 #7, #9, #12, #15, and N1.

## Cross-mode
Unchanged from G8. The radio is held for the fort, lent for Vic and ducked for the other 5 (G8 #5, #18, N2). The full map is blocked in every boss mode (07b_fullmap.js:188-189). Frame order is in 07_main.js:153-160.

## Recommended fix order for the build thread
1. G8 #2 (fort clear lost on ✕).
2. G8 #5 together with N2: hold the radio instead of ducking it in the 5 modes. That fixes iOS and hides the ticker titles.
3. G8 #3, #4, #6–#8: raise touch targets to at least 44 px.
4. G8 #1: wire the GR3 writing pack.
5. The minor findings.

```
SELF-CHECK G10 (P-014)
reviewed: review/integration @ 5f3b4de (temp worktree, read-only); game code identical to G8's 2a07156 (git diff --quiet src site/game.js README.md -> 0)
findings: 22 = 19 carried from G8 (open) + 3 new (N1-N3); G8 fixed 0, closed by evidence 1 (#20, except Vic)
by severity: blocker 0, major 5, minor 17
per mode: fort 4 (G8 2,3,6 + 14 share), derby 2 (G8 4, N2), vic 6 (G8 7,9,12,15, N1 + 14 share), duels 2 (G8 8, N3), racers 3 (G8 10,11,13), cross-mode 6 (G8 1,5,14,16,17,18,19 less shared)
UNVERIFIED: G8 5, 16, 18; N1 (other phases), N2 (exact TRACKS line), N3 (exact label line)
win+lose reachable: 7/7 modes
files read: README.md, src/09_fort.js, src/06g_derby.js, src/06g0_boss_clear.js, src/09a_duel_core.js, src/09b_jimmy.js, src/09c_chipkid.js, src/06h_racers.js, src/06v_vic_rhythm.js, src/07_main.js, src/07b_fullmap.js, src/08_radio.js (via G8, unchanged), site/home/*_390.png (7), content/g3_qa_template.md, content/g8_integration_qa.md
```
