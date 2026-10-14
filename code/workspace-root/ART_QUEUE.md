# Queued art workers (dispatch when a slot frees; max 8 concurrent)
1. boss-ko-10-11: Armaggon L10 + Leatherhead L11 painted hurt/fall/down/KO/getup frames (template brief).
2. boss-l14-15: L14 outro Shredder cameo -> real level15_shredder.png; L15 Shredder (+Super) fall/down/KO frames; L15 Foot Elite own painted sheet. Don't touch Krang.
3. Regular enemies all levels (only ninja + gunner sheets recolored) — needs plan per level enemy types.
4. TMNT turtle specials painted poses + HUD portraits per brother + boss portraits.
5. Code-drawn vehicles/props/hazards/pickups per level (Med).
6. SF: 5 enemy types share scout sheet; karateka heavy; dojo props/food; title/map art; remove 1.5MB unused SS images; SF music.
7. Final: coordinated deploy of shellshock-live after all boss workers pass + full chained headless run L1-15; then recapture trailer (incl Super Shredder) with new art.

## TRAILER REBUILD (user req a67f0950, 16:49) — dispatch at next free slot
- Record the game INSIDE the arcade cabinet view (mobile cabinet mode: SHELL SHOCK marquee, screen bezel, joystick + ATTACK/JUMP/SPECIAL buttons) with the joystick tilting and buttons lighting up in sync with the inputs. Ref: /workspace/uploads/IMG_8824.jpeg
- No cheating: the current trailer bot always pushes forward, so bosses are pinned to the right wall / half off screen (Cold Front in /workspace/uploads/IMG_8827.jpeg). Need a real-play bot that retreats/spaces so boss attacks happen mid-screen, with dodges and jumps, and the boss fully visible and centered.
- Use the new boss art for all 15 levels + Super Shredder phase 2. Wait for the art workers to finish first (or capture the levels whose art is final).
