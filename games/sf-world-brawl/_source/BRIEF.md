# Street Fighter arcade brawler — fan game built on the Shell Shock Live engine
User's full 12-stage design is saved below (verbatim summary). Build ONE LEVEL AT A TIME. This run: engine fork + Stage 01 only.

## Source to fork (read-only, never modify)
- Game: /workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html (+ assets beside it; deploy copy /workspace/work/deploy/shell-shock-live-action/)
- Level plugin API: see level2.js–level8.js and /workspace/work/levels_staging/BRIEF*.md for the v1/v1.1 API.
- Other agents are editing levels_staging/ for Shell Shock Live — do not touch it.

## New project
- Work in /workspace/work/sf_brawler/game/ (copy the engine there).
- Same feel: arcade cabinet frame, title/home screen, character select/tag-in roster of 4 fighters, SPECIAL button, throws, props, pizza→food pickups (tea, onigiri, roast chicken, sushi), EASY/NORMAL/HARD, top-10 initials high scores, 12-stop stage map, mobile controls, PWA manifest/icons.
- Playable roster (none are bosses): Ryu, Cammy, Fei Long, Dee Jay — each with a signature SPECIAL (Hadouken, Cannon Spike, Rekkaken, Machine Gun Upper). Generate new sprite atlases in the same photo-cutout style as the existing atlas_*.png (same frame layout so the engine works). Original generated art only; no ripped Capcom sprites, no actor photos/likenesses.
- Rebrand all text, title logo, music, high-score keys (separate localStorage namespace), manifest name. Working title: "STREET FIGHTER: WORLD BRAWL" (fan game).
- Character names are fine (user accepted IP risk, same as the TMNT game). Do NOT put actor names in the game unless verified on https://en.wikipedia.org/wiki/Street_Fighter_(2026_film); otherwise leave casting out.

## Stage 01: Ryu's Dojo (this run)
Misty mountainside dojo in Japan at dawn. No cheap hazards; cedar corridors, breakable training dummies, shoji screens, scroll racks dropping tea/onigiri. Enemies: Shadaloo scouts, rogue karateka. Mid-stage boss: Ken Masters sparring (teaches parry/punish windows). End boss: shadowy Evil Ryu projection — fast Hadoukens, teleport dashes, vanishes at 10% health (cutscene). Outro teases Stage 02 Metro City Streets.

## Later stages (do not build now — map labels only)
02 Metro City Streets (Balrog) · 03 E. Honda's Bathhouse (E. Honda) · 04 Guile's Airbase (Guile) · 05 Blanka's Jungle (Blanka) · 06 Zangief's Steel Mill (Zangief) · 07 Vega's Cage (Vega) · 08 Dhalsim's Temple (Dhalsim) · 09 Hong Kong Rooftops (Vega's Lieutenant & Doll Unit, Chun-Li AI ally) · 10 World Warrior Arena (M. Bison) · 11 Shadaloo Base (Final Form M. Bison) · 12 Akuma's Volcano, secret 1CC stage (Akuma). Full design text: /workspace/work/sf_brawler/DESIGN.md

## Done means
- node --check passes; headless Chromium auto-play from title through Stage 01 (Ken, Evil Ryu, outro, results, score entry) with zero page errors, plus a forced-deaths run with tag-ins.
- Screenshots viewed: title, gameplay, Ken, Evil Ryu, outro.
- Deploy with surge (SURGE_LOGIN=rbparle@gmail.com SURGE_TOKEN=$(cat /workspace/work/.surge_token), npx -y surge@0.24.6) to https://sf-worldbrawl.surge.sh (pick a close variant if taken), verify HTTP 200.
- Write /workspace/work/sf_brawler/NOTES.md (design, API, how to add Stage N plugins). Report URL, what's in Stage 01, any gaps.
