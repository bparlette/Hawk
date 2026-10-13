# G25 · QA of review/integration-lex (Lexington Market, Westminster Burying Ground, Rash Field, Harborplace octagon)
Re: P-045 · branch review/integration-lex, fetched tip b7c6252 ("review snapshot of hark/integration 017986f"). 017986f itself is not in the shallow fetch, so the content is assumed to match it (UNVERIFIED).
I reviewed the code only, in a temporary detached worktree that has since been removed. Template: content/g3_qa_template.md (FAM-3 static props, FAM-7 writing, gate O).

## Delivery: integration-lex — overall FAIL (gate O, Originality, fails)

## Tool runs
- `node --check` on all 33 src/*.js files: 0 failures.
- `tools/tc_lint.mjs .`: exit 1, 256 ERROR, 0 WARN. These are expected in an integrated game build: the import, lights and Mesh*Material rules apply to delivery folders. The new files add only 1 ERROR (03d_lexington.js:34, C3 MeshBasicMaterial for the additive night glows). 09d_pete.js has 11.
- `tools/tc_canary.mjs`: not run, because it needs this session's expected strings and none were supplied (UNVERIFIED, see template C1).

## Findings
1. [blocker] src/03d_lexington.js:14-17, 251-262, 304-316: the real HOOTERS wordmark is drawn in its orange channel-letter style with silver returns, white halos and a **® mark**. There is also an owl mascot on the menu board (264-271, 316). This is a real brand wordmark plus its brand character, which HOMAGE.md forbids ("no logos, wordmarks… real brand characters"). Fix: rename it to an original homage (e.g. "HOOT HARBOR WINGS"), drop the ®, change the letterform and colours, replace the owl with an original mascot, and take "SUITE 1445" off (it is the real address, line 311).
2. [blocker] src/09l_lexington.js:13-14 and the GOTO keys at 32-33: the popup and blurb print "HOOTERS" and describe the real restaurant. Fix: use the homage name from #1 throughout.
3. [major] src/03b_landmarks_hd.js:246-390 (already in the build, re-flagged): the Hard Rock Cafe logo, the HRC roundels and "SAVE THE PLANET" are drawn as real signage. The comment at line 86 cites a "real-signage rule" from 2026-10-11 that contradicts HOMAGE.md from the same date. Brad needs to rule on which applies. Until he does, treat these as risks.
4. [major] src/06e_gr1_data.js:3 (landmarks): the "M&T BANK STADIUM", "UNDER ARMOUR" and "DOMINO SUGARS" names are corporate trademarks used as landmark names. Real place names are allowed under W2, but these are brand names. Fix: rename to "RAVENS-STYLE STADIUM"/"TIDE POINT"/"SUGAR REFINERY", or get Brad's sign-off.
5. [major] src/09d_pete.js:37, 277 (plus 11 lint C2 hits): the eat-off uses Math.random, so bot runs (?peteauto) can't be reproduced. This was already raised in R-034 and is still open. Fix: use a seeded rnd.
6. [major] src/09d_pete.js:20-22, 431, 454: Pete now resolves the real anchor (`LEX.src='LEX_ANCHOR'`, exported at 03d_lexington.js:47), but the TEMP_ANCHOR fallback and the late re-hook at line 454 are still there. Fix: delete the fallback once 03d always loads, or log a warning if src stays 'temp'. Clean start and end were not exercised in a browser (UNVERIFIED).
7. [minor] src/09l_lexington.js:16-21: spotTick writes `#lmk` and `CITY.lmkT` with no guard for MODE.duel, fort, derby or racers. It only checks `CITY.lmk`. MODE.ticks run every city frame (07_main.js:204), so a Westminster popup could fire during a duel near those spots. Fix: return early when `MODE.duel || DUELS.cur`.
8. [minor] src/09l_lexington.js:35-47: `?goto` overrides `scene.onBeforeRender` and the fog globally. It is test-only, but it can stack on top of `?duel=` and `?pete=`. Fix: ignore goto when a duel param is present.
9. [minor] src/09l_lexington.js:13: the Westminster blurb names Edgar Allan Poe, a real person, but that is historical fact (allowed). The crow tie-in to "Raven King" is fine. There are no grave names or logos on the stones (03d_lexington.js:141 onward). No action needed.
10. [minor] site/index.html:197 with 09l:14: "- WESTMINSTER BURYING GROUND -" is 30 characters at 11 px with nowrap. That comes to roughly 330-360 px on a 390 px screen, so it may touch the edges. Fix: shorten to "WESTMINSTER GRAVES" on narrow screens. UNVERIFIED, needs a 390x844 screenshot.
11. [minor] src/03d_lexington.js: 68 build calls (Mesh/box/cyl/SG.add). The night glows (LEXW.night) are separate additive meshes, so each glow adds a draw call: Lexington uplights plus 2 halos. The lmHD/lexFar chunks look merged. Fix: merge the glow quads into one mesh per district. Draw calls were not measured (UNVERIFIED, needs viewer readout).
12. [minor] No duplicate ids between the new LANDMARKS (lexington, rashfield) and the existing ones. The new globals (HOO, LXM, RSF, LEXW, LEX_ANCHOR, POE_ANCHOR, RASH_ANCHOR, HOOTERS_ANCHOR) don't clash with derby, racers, fort, duel or Vic (grep). The fullmap entries at 07b_fullmap.js:30,34 have no Westminster or octagon footprint. Fix: add them if the octagon should show on the map. I found no radio hold in the new code.

## Top 3 fixes
1. Turn the Hooters octagon into an original homage: name, letters, no ®, no owl, no suite number (#1, #2).
2. Get Brad's ruling on real-signage vs HOMAGE.md for Hard Rock and the corporate landmark names (#3, #4).
3. Seed Pete's RNG and remove the temporary anchor (#5, #6).

## UNVERIFIED
- That b7c6252 matches 017986f exactly: needs a fetch of 017986f.
- Canary strings: need Brad's paste.
- Mobile 390 px overlap, draw calls and mesh counts: need screenshots and viewer readouts.
- A live Pete start/end at LEX_ANCHOR: needs a browser run with `?pete=1&peteauto=win`.
