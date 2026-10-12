# GULF THUNDER — progress log

Source: /workspace/work/tip/site (index.html + js/core.js, art.js, scenes.js, boat.js, brawl.js, kasbah.js)
Tests: /workspace/work/tip/test (smoke.js, botrun.js), screenshots in /workspace/work/tip/shots

- All art is procedural 16-bit pixel art drawn in code (puppet-rig characters with auto-outline, boats, props, painted backdrops). No external image assets.
- Logical 270x480 play area; canvas extends the backdrop to fill any portrait screen (293x633 logical at 390x844 @3x, integer 4x scale).
- Smoke test (390x844 @3x): title + all 5 stages load, 0 console errors, no overflow (scroll 390x844).
- Stage 1 GULF RUN: bot (god) cleared it — boss yacht + docking at Mac's pier. 0 errors.
- Stage 2 PARADISE BEACH: bot (god) cleared it — 4 waves + Big Rico bouncer on the dock. 0 errors.
- Stage 4: bot got stuck (it waited to shoot an enemy one level below). Fixed the bot's level check; re-running.
- Early playable deployed to https://gulf-thunder.surge.sh (all files md5 MATCH). Stage 3 MANGROVE CHASE and Stage 5 STUNT BACKLOT also cleared by the bot (stage 5 run reached the ending), 0 errors.
- Kasbah stage 4 bot fixes (level check + point-blank bullets); platforms now zig-zag across the street. Bot clears stage 4 with and without god mode.
- Full bot run (god, speed 6) title -> 5 stages -> ending: PASS, 0 errors (repeated after every change). Non-god bot also clears stages 1-5 one at a time.
- Touch test 390x844: tap starts game, floating stick moves boat, FIRE shoots, no overflow. Desktop 1280x800: 450x800 canvas centred, 0 errors.
- User change: Paradise Beach resort is now a PINK Mediterranean-revival hotel (flamingo stucco, white trim, three domed bell towers, arched windows, arcaded loggia), not the white Victorian. Also pink cabanas, a small pink palace on the title/ending horizon, pink resort wings at the stage-1 dock. Story cards have no resort art.
- Redeployed gulf-thunder.surge.sh (md5 MATCH), demo page resynced + deployed (MATCH), aistudio commits 01d64f3 + 7408141 (games/gulf-thunder only, not pushed).
