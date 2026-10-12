SEE USER SPEC — Tober's Nightmare (3D remake of a Halloween Atari 2600 homebrew; no Atari branding or copied sprites)

TECH: Three.js (ES module from https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js via import map), single index.html, mobile + desktop, procedural primitive models only, no localStorage/cookies (iframe sandbox allow-scripts only), no backend.

VISUAL (locked): black sky, large orange moon. White ranch house along top edge; small separate white outbuilding at house's upper-right. House doorway glows purple/magenta during return-home phase. Red fence (posts + horizontal rails) across middle with thin green wavy vine beneath. Dark grass. Tober: blond hair, green shirt, magenta/pink shorts. Orange jack-o'-lantern pumpkins in TWO rows near bottom, shifted toward fence so bottom-corner touch controls never cover them. Enemy spells: small yellow squares. Enemy death: pixel-like cube bursts in orange, red, green. HUD: six-digit pink/magenta score top center; three hearts top right, lost hearts = hollow outlines. NO ammo/pumpkin counter, no other HUD clutter.

LAYOUT top->bottom: house (start/goal) / enemy territory / red fence with ONE small opening at random x each crossing / pumpkin patch. Tober hard-clamped to visible playfield on all 4 edges (recompute on resize).

LOOP: start at house with 0 pumpkins -> run down dodging enemies + spells -> fence opening at random x -> pass through, it closes behind -> collect up to 3 pumpkins -> must throw all 3 before opening reopens -> opening reopens (new random x), cross back to house (doorway glows) -> repeat until all enemies dead = level complete. 3 hits (touch or spell) = death -> restart level from house. Levels scale 3->6 enemies with smaller safe gaps.

PUMPKINS: pickup radius ~1.5 movement tiles (nearest pumpkin). Pickup anim: Tober hops onto pumpkin, reaches down, swap — pumpkin balanced on head; carried pumpkins stack visibly on head up to 3. Throw flies straight up-screen toward house over the fence. Hit score by distance: 50 near fence, 150 mid-yard, 200 near house. Patch regrows.

ENEMIES in order: tan spiders, blue ghosts, green/purple ghouls with red caps, gray-green bat/gargoyles. Move laterally, generally advance; fire yellow square spells downward. Touch or spell = 1 hit (brief invuln flash).

POWER-UPS: invincibility star (spawns upper-left or upper-right of house) 10s, touching enemies kills them. Teleport orb: moves Tober to opposite side of fence. Red bonus heart drifting horizontally (often around 2nd throw): +1 heart (max 3) +75 pts. Phantom Gardener (green watering can, blue drops): restores 3 pumpkins.

MOBILE CONTROLS: circular pad bottom-left, movement only, dominant-axis snap (4 dirs, no diagonals ever shown). One orange action button bottom-right: tap near pumpkin = pick up; tap elsewhere while carrying = throw; hold = sprint. ~66% opacity idle, ~94% pressed, full-size hit areas. Separate pointer/touch IDs for multi-touch. Release/slide-off/cancel stops movement instantly. touch-action:none, no scroll/zoom/pull-to-refresh/context menu; touches outside controls ignored. Controls shown only on touch devices.

DESKTOP: WASD/arrows 4-dir (latest key wins), Space tap = action, hold = sprint. P/Esc pause; auto-pause on blur/visibilitychange with resume overlay. preventDefault arrows/Space. Canvas fits window keeping aspect. Brief controls hint at start, dismissed on first input.

STATES: title -> playing -> paused -> level complete -> next level -> game over (restart level from house).

BUILDER'S CHOICE: WebAudio synth SFX, speeds/timings, title art.

HARD RULES: never leave screen; no pixel-perfect pickup; no pad diagonals; no pumpkin HUD; keep stylized 3D look; no Atari branding.
