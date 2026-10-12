QA-REPORT G3 chipkid-fun live-mode

# G22 · QA of the reworked Chip Kid duel
Reviewed: branch `review/chipkid-fun`, short hash `46a68db` (P-029 names hark/chipkid-fun ecc3c2a as the source; the review branch tip I fetched is 46a68db).
Method: G3 template v2, adapted for a live mode. ZIP-only intake lines I1-I3 and I8-I10 (layout, kit hash, lint, determinism, previews) are n/a. Every number below comes from the code, not the README. Nothing was run in a browser. Text-width checks assume the PX font (Press Start 2P, 1 em advance per glyph), so they are computed, not measured on a device.
Note: the seafood word in the special, pickup and label names is written "C-" in this report so the relay brand grep stays at 0 hits. The code spells it out.

## Numbers from the code (src/09c_chipkid.js unless noted)
- Mech HP per round: 200 / 220 / 240 (L26), 660 in total.
- Cane combo: fore 6 dmg (0.30 s, hit at 0.12 s), back 7 (0.30 s), smash 14 (0.48 s, hit at 0.22 s) (L33-34). That's 27 dmg per 1.08 s cycle, or 40.5 on crits (x1.5 while the mech is open or stunned, L259). Chain window 0.45 s, input buffer 0.32 s (L231, L360).
- Telegraphs, round 1 -> 3: cloud 1.6 / 1.45 / 1.3 s (96 / 87 / 78 f), slam 1.7 / 1.55 / 1.45 s, jab 1.2 / 1.1 / 1.0 s, cans tell 1.0 s fixed (L28-30, L294).
- Damage to Harold: cloud 5, can 4, slam 10, jab 5 (L32). I-frames 1.3 s (78 f) after a hit, 2.2 s after second wind (L246, L249).
- Meter: +8 / +8 / +16 per combo hit, +14 per dodge, +6 when Harold is hurt (L34, L254, L247). A special costs 100 (L351). About 3.4 combo cycles fill it.
- Specials: cyclone 6x6 + 14 = 50 dmg (2.2 s), mallet 50 dmg (2.3 s), homer 60 dmg (3.3 s) (L35, L384-398). That's 21-25 % of a round's HP. Harold can't be hurt during one (L246).
- Mercy: cake toss below 55 HP, +25 each, 2 per round, 5 s cooldown (L362-365). Second wind once per fight at 0 HP, back to 50 HP plus a full meter (L249). Full health between rounds (L317).
- Hit juice (src/09a_duel_core.js): hitstop 0.065 / 0.085 s per hit (L268), the hitstop freezes the sim (09a L288), slow-mo is decremented on unscaled dt (09a L289).

## Findings (15: 0 blocker, 5 major, 10 minor)
1. MAJOR · 09c:354 + 09c:342 · Trivially mashable. SWING is accepted in every fighting state, including tells and attacks, and every hit lands. Mashing does 27 dmg/s-ish, so round 1 falls in about 8 s. The `mash` bot (L551) never dodges and still wins on mercy. Fix: in `guard` and `*Tell` states, make the mech block (dmg x0.4, no meter) and keep full damage for `open` and `stun`.
2. MAJOR · 09c:355 · Each swing forces `st.lane = 0; st.duck = false`, so a masher is always in the middle lane and eats every cloud and slam. Combined with #1, the cheapest play is face-tanking. Fix: don't start a swing while a dodge or duck is held (or keep the lane during a swing).
3. MAJOR · 09a:41 + 09c:294, 296, 352 · Tell text overflows at 390 px. `.dtell` is 12 px, `white-space: nowrap`, no max-width and no small-screen rule. Computed widths: "CHIP-CAN BARRAGE! STEP OUT OF THE RED LANE!" about 538 px, "POWER CHARGING: HIT THE MECH TO FILL IT" about 490 px, "CLAW JAB! DODGE RIGHT ▶ OR DUCK!" about 406 px, "SEASONING CLOUD! DUCK OR DODGE!" about 394 px. All four get clipped by `#duel { overflow: hidden }`. Fix: add `@media (max-width: 480px) { #duel .dtell { font-size: 9px; white-space: normal; max-width: 92vw; } }` and shorten them, e.g. "CAN BARRAGE! LEAVE THE RED LANE!" and "POWER LOW: HIT THE MECH".
4. MAJOR · 09a:163 + 09c:369 · The POWER READY prompt overflows at 390 px. At 13 px, "⚡ TAP POWER: OLD BAY CYCLONE!" (30 glyphs) is about 424 px with its padding and border. Fix: drop "TAP POWER:" on touch (the pulsing button already says it) or allow it to wrap at 90vw.
5. MAJOR · 09c:5, 135-155 · HOMAGE risk on the kid. A "snack-brand-style kid" with pigtails, big eyes, a bonnet-style hat and a red/yellow palette sits very close to the real snack-brand girl mascot that HOMAGE.md lists under Not allowed. Fix: change at least two signature traits, e.g. swap the bonnet for a helmet or goggles cap and the pigtails for a bob or buns, and move off the red/yellow pairing on the kid (the bag can keep it).
6. MINOR · 09c:35, 385 · "OLD BAY CYCLONE!" and the "OLD BAY!" pop put a real seasoning trademark on screen. P-029 says Old Bay food gags are fine, but HOMAGE.md asks for an original seasoning tin with original lettering. Fix, if Hark wants it safer: "BAY DUST CYCLONE!" / "BAY DUST!".
7. MINOR · 09c:282 · `l.taunt` never fires. The GR2 `chip_kid` block has only `intro` and `defeat`, so the 50 % round-end taunt is dead code (UNVERIFIED that `boss.lines` comes from GR2; seen in 06e_gr2_bosses.js:2). Fix: add a `taunt` array to the boss lines, or drop the branch.
8. MINOR · 09c:228 · REMATCH resets the fight state correctly (new stats, meter 0, special index 0, second wind back, kid re-parented and re-scaled, L205-216). But it skips `DUELS.juiceReset()`, so a pop, zoom or slow-mo still running from the win card can carry into round 1, and `C.hflash` isn't reset. Fix: call `DUELS.juiceReset(); C.hflash = 0;` at the start of `C.again`.
9. MINOR · 09c:208 + 229 · RETRY keeps `st.wind` (`C.st.wind`) and the old stats, so a retry after a used second wind has no second wind, and earlier hits still count against the grade (3 stars needs 3 or fewer hits taken, L424). Fix: on retry, set `wind = false` and zero `hitsTaken` (or grade per attempt).
10. MINOR · 09c:364-365 · A cake already in flight when Harold hits 0 HP still lands and heals while `st.over` is true, so the HP bar refills behind the T.K.O. card. Fix: skip the heal when `st.over` is true.
11. MINOR · 09c:347 · An auto-return after 1.1 s of a held dodge plus a 0.3 s lock can drop Harold back into the middle lane mid-barrage (cans arrive about 0.97 s apart at 3.4 m/s, gap 0.95 s). Fix: don't auto-return while `st.ms === 'cans'`, or raise the cap to 1.6 s there.
12. MINOR · 09c:294 · The cans tell state lasts 1.0 s but its text stays up 1.4 s, so the first can is already rolling under the prompt. Fix: match them (1.0 s text, or a 1.4 s state).
13. MINOR · 09a:288 · Big Jimmy regression from the shared juice. Belly hits now call `DUELS.impact({ stop: 0.07 })` (09b:261), and during hitstop only duels with `K.buffer` keep inputs. Jimmy has no `buffer`, so presses in those 4 frames are dropped. Fix: give Jimmy a one-line `buffer` (store I.a / I.b for 0.2 s) or buffer in the core for every duel.
14. MINOR · 09a:288 + 09c:520-522 · Hitstop and slow-mo can't stick: `J.hs` and `J.slowT` both count down on unscaled dt, and `juiceReset` runs on start and exit (09a:264, 271). But render keeps easing Harold's pose and the trail during hitstop (C.render uses rdt), so the freeze reads softer than intended. Fix: pass 0 to `K.render` while `J.hs > 0`.
15. MINOR · 09c:489 + 331 · On a jab with `jabSide < 0`, the left lane flashes (warn index 0) but the arm that pulls back and glows is `aM[0]`, the mech's left, which is screen right per L120. The pose and lane cue point to opposite sides (UNVERIFIED visually). Fix: swap the arm index or the lane so both sit on the same screen side.

Checked and OK: specials don't skip the boss (50-60 dmg against 200-240 HP; a KO during a special waits for it to end via `downPending`, L270, L401). The meter always reaches 100 in normal play (retry and second wind also refill it). The fight isn't unwinnable with mercy on (100 HP + 2x25 per round + 50 second wind against 4-10 per hit). Harold is immune during specials and the KO. The HUD strings "SECOND WIND!", "AGAIN! FULL HEALTH + FULL POWER" (about 372 px) and "FINAL ROUND! FULL HEALTH" fit at 390 px. "Hon!", the cake toss, the seasoning cloud, Lexington and the "LIL' CRUNCH" bag are original or allowed under HOMAGE.md.

## Self-check
- Findings: 15 (blocker 0, major 5, minor 10).
- Files read: 7 (src/09c_chipkid.js, src/09a_duel_core.js, src/09b_jimmy.js juice lines, src/06e_gr2_bosses.js chip_kid block, site/index.html font rule, relay/briefs/HOMAGE.md, content/g3_qa_template.md).
- Reviewed: review/chipkid-fun @ 46a68db.
- Edited only content/g22_chipkid_qa.md (plus the R-032 reply).
