# Art & Polish Audit (read-only) — started 2026-10-08
Games: A = Shell Shock Live (/workspace/work/deploy/shell-shock-live-action/), B = SF World Brawl (/workspace/work/sf_brawler/game/)
Legend: (a) own painted image · (b) reused/tinted base sheet · (c) code-drawn

## Game A — global findings (index.html)
- Audio: 100% WebAudio synth (osc/noise/note, index.html ~L155-330). No audio files. 4 core tracks (title/stage/boss/clear).
- Every level's bossMusic = A.transpose(A.TRACKS.boss, ...) — same boss tune transposed in all 14 levels (L2–L15). Each level has its own `music` track (A.track) though.
- Core images loaded: hallway.jpg, room.jpg, stairs.png, drill.png, ball.png, stick.png, atlas_{lenny,rafe,miko,donny,ninja,gunner,zap,ramrod,amber,razor}.png

### Game A — shared elements (used by every level unless overridden)
| Element | Render | Where | Priority |
|---|---|---|---|
| Players Lenny/Rafe/Miko/Donny | (a) atlas_lenny/rafe/miko/donny.png — only 6–7 frames each (idle, walk[,walk2], attack, jump, hurt, down). No combo/throw/special/death/victory frames; specials reuse `attack` + code rings | drawPlayerAtlas → drawFrame | **High** (frame count gap) |
| Player fallback | (c) drawTurtle (pixel rects) — only while atlas loads / title fallback | index.html:717 | Low |
| Specials (Cyclone/Drill Dive/Copter/Vault) | (c) drawSpecialFx ellipse rings + triangle; no painted special pose | index.html:3330 | Med |
| Swing trails | (c) drawSwingTrail | 2705 | Low |
| Foot soldiers purple/blue/star/sword | (b) atlas_ninja.png hue-rotated per type (NINJA_HUE) — one 6-frame sheet for all; per-level `hues` recolour again | drawNinjaAtlas/ninjaSheet | **High** |
| Gunner / heavy / dasher | (b) atlas_gunner.png tinted (heavy = 1.18× scale, dasher = hue 100 recolour of gunner? dasher uses ninja sheet w/ hue 100) | drawNinjaAtlas | **High** |
| Enemy fallback | (c) drawNinja 99-line rect figure (fallback only) | 1952 | Low |
| Ninja weapons (blue knife, sword, gunner blaster) | baked in atlas only for base; no separate weapon art | — | Low |
| Ramrod (L1 boss) | (a) atlas_ramrod.png | drawRamrod | OK |
| Zap-Rollers (L1) | (a) atlas_zap.png; whip = (c) zig() lightning; dying smoke (c) | drawZapAtlas/drawWhip | Low (FX) |
| Scorcher (L1 mid-boss) | (b) ramrod atlas tinted (MIDBOSS_CFG, hue -25) | index.html:3477 | **High** |
| Razor (L1 kidnapper) | (a) atlas_razor.png — only 4 frames, carry reuses grab | drawRazor | Med |
| Amber (hostage) | (a) atlas_amber.png (tied/shout/free); "HELP!" bubble code | drawAmber | Low |
| Drill pod | (a) drill.png | drawPod | OK |
| Ball (L1 stairs) | (a) ball.png | drawBall | OK |
| L1 backgrounds | (a) hallway.jpg (tiled + mirrored), stairs.png, room.jpg; fire FX (c) drawFlame/drawHallFG/ceilingSmoke | drawHall/drawRoom | Low |
| Props: barrel, crate, trash, cone | (c) drawProp — all rect pixel art, incl. rolling barrel + break chunks | 3214 | **Med** |
| Pickups: pizza, slice | (c) drawItem rect/ellipse | 3100 | **Med** |
| Pizza Break cutscene | player atlas idle + (c) box/slice/crumbs (drawPizza, drawSlice) | 1312 | Med |
| Default projectiles brick/snowball/sludge/tire/rock | (c) drawShot | 3859 | Med (bricks/tires visible) / Low |
| Shuriken | (c) drawStar (two rects) | 2523 | Low |
| Ray bolt | (c) drawRay gradient | 2507 | Low |
| Hoverboard/skateboard on auto-scroll | (c) drawBoard rects | 3918 | Med |
| Weather rain/snow/drips/embers/speed | (c) drawWeather | 3893 | Low |
| HUD P1 portrait | (c) 20px rect turtle face, same face for all 4 bros (mask colour only) | drawStage ~2915 | **High** (HUD portrait) |
| HUD boss bar | text + bar only — no boss portrait at all | ~2950 | Med |
| Title logo | (c) drawLogo block-pixel font | 850 | **Med** (title art) |
| Title / map / select backdrop | (c) drawNight gradient skyline + moon | 867 | **Med** |
| Title brothers | (a) rim-lit atlas idle frames | drawRimIdle | OK |
| Select weapon icons | (c) drawWeaponIcon | 948 | Low |
| Stage map | (c) drawMap: dots/circles over drawNight; brother = atlas idle | 3442 | **Med** |
| Level title card | level bg at 45% + text | drawLevelCard | Low |
| Results / initials / score table / loading | text + rects | 2972/3399/3415/3626 | Low |
| Speech bubbles | (c) bubble() | 2410 | Low |

**Correction to table above:** dasher = atlas_ninja recoloured (hue 100), heavy = atlas_gunner recoloured (hue 150, 1.18×). So the entire non-boss roster across all 15 levels is TWO painted sheets (ninja, gunner), re-hued per level via each level's `hues` map.

**Boss death/hurt frames (engine-wide):** drawBossCfg (index.html:3803) fakes "down/dying" for non-ramrod sheets by rotating the idle/leap frame 90°. Sheets with no down frame: atlas_zap-based, atlas_razor (L8), level10_armaggon (no down), level11_gator (no down), level15_shredder (no down; rotated via spr(rot)). Players: single `down` frame, no death/KO sequence. Enemies: one `down` frame, `dying` = blink. → **High**

## Game A — per level

### Level 1 (built in, index.html) — hallway/stairs/apartment
- Players (a) · Foot soldiers (b) ninja/gunner sheets · Zap-Rollers (a) atlas_zap · Ramrod boss (a) atlas_ramrod · **Scorcher mid-boss (b) tinted ramrod — High** · Razor (a) atlas_razor (4 frames) · Amber (a) · drill pod (a) drill.png · ball (a) ball.png · BGs (a) hallway.jpg/stairs.png/room.jpg · fire/smoke (c) drawFlame/drawHallFG/ceilingSmoke — Low · Zap whip (c) zig — Low · props/pickups (c) — Med.

### Level 2 — STREET RUMBLE (levels/level2.js)
- BG (a) level2_street.jpg, single section, no separate boss arena bg.
- **Boss BRICKJAW (b) atlas_ramrod tinted (hue 280) — High** (known).
- Projectile brick (c) drawShot — Med. Minions purple/heavy (b) — High (global).
- Hazards: manholes (c) ellipses+steam — Med; fire hydrants + water jet (c) api.rect + gradient path — Med.
- Weather rain (c) Low. Outro: bark text only.

### Level 3 — SEWER SHOWDOWN
- BGs (a) level3_sewer.jpg, level3_sewer_boss.jpg.
- **Boss GULCH GATOR (b) ramrod tinted (hue 55) + (c) drawGatorHead code-drawn gator head pasted over the sprite (L246) — High** (worst-looking boss after Krang: mismatched code head on painted body).
- Gator death/hurt: ramrod frames.
- Rats/"rat tails" on wading dashers (c) wading — Med. Pipe gush (c) pipes — Low/Med. Geysers + iron grate (c) geysers — Med. Sewer flood waves + lane chevrons (c) waves — Med. Splash (c) Low. Sludge projectile (c) Med. Minions dashers (b).

### Level 4 — SUNSET SHRED (auto-scroll highway)
- BG (a) level4_highway.jpg (same image reused for BOTH sections, `bg: BG` twice) — Med.
- **Boss JETWASH (b) atlas_gunner tinted, 1.25× + (c) jetpack/exhaust in bossDraw (L395) — High** (known).
- **Cars, box trucks, Jetwash's armoured big rig (c) drawVehicle (L52) — Med (large, very visible)**.
- **Motorbike riders (c) riders.drawFront — rect motorbike under tinted ninja dashers — Med**.
- Hover-drones + reticles (c) drones — Med. Rockets/lane missiles/carpet bombs (c) rocket — Med. Oil slicks (c) road — Med. Skateboards (c) drawBoard — Med. Speed lines (c) Low.

### Level 5 — DOCKSIDE DOUBLE-CROSS
- BGs (a) level5_docks.jpg, level5_docks_boss.jpg.
- **Boss GRIMWALE (b) ramrod tinted (hue 155) — High** (known). Harpoon + rope (c) deckDrawFront — Med.
- Dock doors + klaxon (c) makeDoors — Med. Crane hooks/anchors (c) anchorArt/chain — Med. Falling crates (c) crateArt — Med. **Forklift (c) forklift (20 draw calls) — Med**. Deck hatches/gear (c) — Med. Splinters (c) Low.

### Level 6 — FROSTBITE BOULEVARD
- BGs (a) level6_snow.jpg, level6_snow_boss.jpg.
- **Boss COLD FRONT (b) atlas_gunner tinted 1.35× + (c) freeze-gas tank (bossDraw L316), spray (drawSpray), ice shards (drawShard) — High** (known).
- **Snowplow truck (c) drawPlow (27 calls) — Med**. Icicles (c) drawIcicle — Med. Snowball lobbers' snowballs (c) — Med. Ice patches (c) Low. Frozen-player block (c) drawFrozen — Med.

### Level 7 — SCRAPYARD SMASH
- BGs (a) level7_junkyard.jpg, level7_junkyard_boss.jpg.
- **Boss RUSTMAUL (b) ramrod tinted (sepia 1, hue −28) — High** (known). Magnet aura (c) drawBossAura — Low.
- Conveyor (c) — Med. Grinder + sparks (c) — Med. **Crane magnet (c) — Med**. Rolling scrap/rollers (c) — Med. **Crusher (c) — Med**. Tire projectiles (c) drawShot — Med. Scrap drops (c) — Med.

### Level 8 — FORTRESS OF RAZORBACK
- BGs (a) level8_fortress.jpg, level8_final_boss.jpg (blast doors are painted into the bg and split via drawImage — good).
- **Boss RAZORBACK (b) atlas_razor (the L1 kidnapper sheet, 4 frames: idle/grab/leap) scaled up + red/hot tints; "down" = rotated leap frame — High** (NOT in the known list: L8 boss reuses a base sheet too).
- Ray bolts (c) drawRay Low. Spinning razor discs (c) drawDisc — Low/Med. Lasers + pylons (c) — Med. Vents (c) — Med. Floor panels (c) — Med. Reactor core (c) throneRoom — Med.
- Amber (a) atlas_amber in outro; brothers (a) atlas.

### Level 9 — SHADOWS OF EDO
- BGs (a) level9_edo.jpg, level9_castle.jpg.
- Boss KARAI (a) level9_karai.png (idle/walk/slash/throw/hurt/down/kunai) — OK. Kunai (a) from sheet. Speech box (c) Low.
- Clones/afterimages = Karai sheet (fine). Time vortex (c) Low. Smoke bombs (c) — Low/Med. Spike traps (c) — Med. Arrow volley + stuck arrows (c) — Med.
- **Outro: ship silhouette + night sea drawn in code (outro, 14 calls) — Med (cutscene art)**.

### Level 10 — PIRATE SHIP
- BGs (a) level10_galleon.jpg, level10_galleon_boss.jpg (rolled/mirrored by rollView).
- Boss ARMAGGON (a) level10_armaggon.png (idle/idle2/bite/fire/hurt/walk) — **no down/death frame — High**. Dorsal fin (c) drawFin — Med. Harpoon + tether (c) — Med.
- Ship hazards: rolling barrels, cannon volleys, rigging ropes, lightning (c) ship — Med.
- **Outro: desert sun, mesas, saguaro, rails, steam locomotive silhouette, rift — all code (23 calls) — Med**.

### Level 11 — WILD WEST TRAIN
- BGs (a) level11_desert.jpg (parallax), level11_train.jpg, level11_boss.jpg.
- Boss LEATHERHEAD (a) level11_gator.png (idle/walk/tail/chomp/crate/hurt) — **no down frame (rotated) — High**. Thrown crates/barrels (c) drawThrown — Med.
- **Outlaw car (c) outlawCar (15 calls) — Med**. Track gaps/ties (c) — Med. Events (portals, duck prompts; 40 code calls) — Med. Tumbleweeds/hats (c) — Low. Outro vortex (c) Low.

### Level 12 — FUTURE NYC 2105
- BGs (a) level12_skyway.jpg, level12_datahub.jpg.
- Boss VIRAL (a) level12_viral.png (idle/walk/attack/hurt/down) — OK; glitch/dissolve FX on sheet — good. Decoy clones = same sheet. Beam (c) drawBeam Low. Bolts (c) Low.
- **Pixel-swarm drone minions (c) hub (orbit/dive) — Med**. **Flying traffic (c) traffic (20 calls) — Med**. Security drones + searchlight (c) drones (16) — Med. Anti-grav pads (c) Low/Med.
- **Outro: alien sun + floating rock islands (c) — Med**.

### Level 13 — DIMENSION X
- BGs (a) level13_dimx.jpg, level13_dimx_boss.jpg, level13_earth.jpg (outro).
- Boss GENERAL TRAAG (a) level13_traag.png; Lt. GRANITOR (a) level13_granitor.png — both have hurt/down — OK.
- Cannon shells (c) drawShell — Low/Med. Acid pools (c) — Med. Chasm (c) — Med. Meteors (c) — Med. Bunkers/artillery (c) arena — Med. Portal (c) drawPortal Low.

### Level 14 — TECHNODROME PORTAL
- BGs (a) level14_technodrome.jpg, level14_portal.jpg.
- **Boss KRANG android (c) drawKrang/legPose/armPose/drawBrain (55+ calls) — High** (known, being fixed).
- **Krang's flying fist (c) fistDraw — High (boss attack)**.
- **Mousers (c) drawMouser — Med (minion, very visible)**.
- **Falling fortress modules (c) drawModuleBody/Back/Front — Med**. **Turrets + beams (c) drawTurrets — Med**. Portal lightning (c) Low.
- **Outro: Krang brain-walker (c) drawBrainWalker; Shredder cameo = (b) steel-tinted ninja sheet + (c) code helmet/cape/horns (drawShredder L690) — High (cutscene figure; level15_shredder.png exists and should be used)**. Wreck (c) drawWreck — Med.

### Level 15 — SHREDDER'S TOWER
- BGs (a) level15_elevator.jpg, level15_penthouse.jpg, level15_lab.jpg.
- Boss SHREDDER (a) level15_shredder.png (idle/walk/attack/jump/hurt) — **no down frame (rotated) — High**. Shuriken (c) shuri — Low.
- Final boss SUPER SHREDDER (a) level15_super.png (idle/walk/blast/raise/hurt/down) — OK. Energy orbs (c) orbDraw — Low. Stomp shockwave (c) Low.
- **Foot Elite (b) tinted atlas_ninja — High** (named elite troops are just recoloured grunts).
- Elevator car/judder overlays (c) elevator — Low/Med. Mutagen vats (c) vats — Med. Lab wall breach/debris (c) labArena/addDebris — Med.
- **Outro: rubble/white-out/sunrise (c) + brothers & Amber atlases — Med**. Trailer: Super Shredder phase missing (known).

## Game A — Other shortcuts
| Item | Detail | Priority |
|---|---|---|
| Boss music reused | Every level L2–L15 `bossMusic = A.transpose(A.TRACKS.boss, …)`: one boss tune, re-keyed/re-tempo'd 14 times. Final bosses (Shredder/Super Shredder) get the same tune | **High** |
| All audio synthesized | Chip-synth only (osc/noise), no recorded SFX; ~20 shared SFX voices (swing/hit/boom…) used by every level and character | Med |
| Voice barks via browser TTS | `speechSynthesis` reads lines aloud (index.html ~L382): robotic, different on every device, often silent on iOS | Med |
| Copy-pasted enemy roster | Only 7 enemy AI types (purple/blue/star/sword/dasher/heavy/gunner) in index.html; every level reuses them and only changes `hues`. No level-specific grunts (no Mousers-as-enemies outside L14, no pirates, cowboys, robots, Stone Warriors) | **High** |
| Boss move sets copy-pasted | L2/L3/L5/L6/L7 bosses all run the engine's Ramrod moveset (charge/kick/throw/slam/summon) with a different projectile | **High** |
| Reused backgrounds | L4 uses level4_highway.jpg for both sections; L2 has no boss-arena bg; L1 hallway.jpg tiled+mirrored | Med |
| Missing death animations | Bosses w/o down frame rotated 90° (L8 Razorback, L10 Armaggon, L11 Leatherhead, L15 Shredder, all tinted-ramrod bosses use ramrod "down"). Players & grunts: one `down` frame, blink-out death | **High** |
| Player frames thin | 6–7 frames per brother; no combo strings, throws, grab, special or victory poses | **High** |
| Mid-boss | Only L1 has one (Scorcher, tinted ramrod) | Med |
| Placeholder text | Map "? = COMING SOON" / loader "COMING SOON!" only appear on error now (all 15 named) — Low. Debug hooks (`?debug`, `window.__L11`) shipped — Low | Low |
| HUD | P1 portrait = generic rect turtle face for all four; boss bar has no portrait | **High** (portrait) |
| Trailer | Super Shredder phase missing (known) | Med |
| Mobile | Rotate hint only on title screen; touch controls are DOM overlay on cabinet art; TTS barks unreliable on iOS; no haptics on iOS (navigator.vibrate unsupported). Not device-tested in this audit | Med |

---------------------------------------------------------------------

## Game B — Street Fighter: World Brawl (/workspace/work/sf_brawler/game/)
Same engine as Game A (forked index.html), one level plugin (levels/level1.js).

### Shared / global
| Element | Render | Where | Priority |
|---|---|---|---|
| 12 playable fighters (Ryu, Ken, Chun-Li, Guile, Blanka, Honda, Zangief, Dhalsim, Cammy, Fei Long, Dee Jay, T.Hawk) | (a) atlas_<key>.png each — only 6 frames (idle/walk/attack/jump/hurt/down) | drawPlayerAtlas | **High** (no special-move poses, no kicks vs punches, no victory) |
| Specials | (c) reuse existing frames + code FX: Hadouken/Yoga Fire/Sonic Boom projectiles (c) drawHadou/drawPShots; Shoryuken = `jump` frame + code flame; Electric Thunder = **`hurt` frame** + code sparks; Lariat = `idle` frame flipped; Hundred Hand Slap = code palms; Spinning Bird = `jump` flipped | SPECIALS L3362, drawSpecialFx L3444 | **High** (signature moves have no painted poses) |
| Fighter fallback | (c) drawTurtle — a **TMNT turtle** pixel figure if an atlas hasn't loaded (L1363/2818/2853) | 731 | Med (wrong-franchise fallback) |
| Grunts: purple/blue/star/sword/dasher | (b) one sheet atlas_ninja.png (repainted as red-masked Shadaloo scout); NINJA_HUE = {} and level hues {} so **all five types look identical** | drawNinjaAtlas | **High** |
| Heavy / gunner | (b) atlas_gunner.png (repainted karateka); heavy = same karateka at 1.18× | drawNinjaAtlas | **High** |
| Unused art: art/scout_sheet.png, art/karateka_sheet.png are the sources of the above; no other grunt sheets exist | — | — |
| Props: training dummy, shoji screen, scroll rack (+ engine barrel/crate/trash/cone) | (c) drawProp (56 draw calls) | 3266 | **Med** |
| Pickups: onigiri, tea, roast chicken, sushi platter | (c) drawItem / drawSlice rects | 3147/1341 | **Med** |
| Food-break cutscene | fighter idle frame + (c) box/food (drawPizza, still pizza-box logic) | 1348 | Med |
| Projectiles hadou / hadoudark / sonic / fire | (c) drawHadou gradients, sonic crescent | 3402/3412 | Low–Med (Hadouken is iconic; painted sprite would help) |
| HUD P1 portrait | (b-ish) head crop of the fighter's idle atlas frame — painted but tiny/cropped, not a real portrait | drawStage ~2964 | Low |
| Select screen portraits | head crop of idle frame (drawPortrait) | 960 | Med (no proper character-select portraits) |
| Boss HUD | name + bar, no portrait | — | Med |
| Title logo | (c) drawLogo block-pixel "STREET FIGHTER / WORLD BRAWL" | 871 | **Med** |
| Title / map backdrop | (c) drawNight — the **TMNT night-city skyline + moon** reused | 888 | **Med** |
| Stage map | (c) drawMap circles/dots over drawNight; fighter = atlas idle | 3570 | **Med** |
| Weather / swing trails / bubbles | (c) | — | Low |
| Cabinet | (a) cabinet_special.png (SF repaint; cabinet_nostick.png is a byte-identical copy) | — | Low |

### Stage 01 — RYU'S DOJO (levels/level1.js)
- BGs (a) levels/level1_dojo.jpg (corridor), levels/level1_arena.jpg (main hall). Mist + cedar needles (c) `mist` — Low.
- Grunts: (b) scout + karateka sheets, untinted — High (see above).
- Mid-boss KEN MASTERS (a) atlas_ken.png (idle/walk/charge/kick/fire/rise/hurt/down) — OK. Shoryuken flame (c) drawOver ellipse — Low. "OPEN!"/"!" text tells — Low.
- Boss EVIL RYU (a) atlas_evil.png — OK. Dark aura (c) ellipses — Low. Vanish = alpha flicker + smoke, no painted dissolve — Low.
- Props dummy/shoji/scrolls (c) — Med. Food pickups (c) — Med.
- Coach "TIP:" banner (c) text — Low.
- Outro: text-only "STAGE 01 CLEAR / NEXT: STAGE 02" on dark overlay, no art — **Med**.

### Stages 02–12 — NOT BUILT
Only names in LV_NAMES/LV_BOSS (index.html:3556): Metro City Streets (Sodom), Honda's Bathhouse (Birdie), Guile's Airbase (Balrog), Blanka's Jungle (Rolento), Zangief's Steel Mill (Hugo), Vega's Cage (Vega), Dhalsim's Temple (Juni & Juli), Hong Kong Rooftops (Adon), World Warrior Arena (Sagat), Shadaloo Base (M. Bison), Akuma's Volcano (Akuma). No level files, no backgrounds, no boss sheets (11 bosses + any grunts needed). Map shows "STAGES 2-12: COMING SOON"; selecting one hits the loader's "COMING SOON!" error. — **High**

### Game B — Other shortcuts
| Item | Detail | Priority |
|---|---|---|
| Stages 2–12 missing | labels only (above) | **High** |
| Grunt variety | 5 enemy types share one untinted scout sheet; behaviour differs but look doesn't | **High** |
| Boss music | `bossMusic = A.transpose(A.TRACKS.boss, -2, 168)` — Shell Shock's boss tune re-keyed. Title/stage/boss/clear core tracks are the TMNT game's tracks verbatim (same TRACKS in engine) | **High** |
| SFX | Same synth SFX set as Shell Shock; no hit/voice samples ("Hadouken!" is browser TTS if anything) | Med |
| Specials use wrong frames | Blanka's Electric Thunder uses the hurt frame; Lariat uses idle; Yoga Fire uses idle | **High** |
| TMNT leftovers (dead weight) | index.html still preloads 9 TMNT assets never used by Stage 1: hallway.jpg, room.jpg, stairs.png, drill.png, ball.png, atlas_zap/ramrod/amber/razor.png (~1.5 MB). Dead code/strings: drawCard "FIRE! WE GOTTA GET AMBER OUT!!" (unreachable after early return), "RAMROD"/"ZAP-ROLLER" HUD fallbacks, "AMBER'S APARTMENT →", MIDBOSS_CFG "SPARRING PARTNER" = tinted ramrod, drawHall/drawRoom/drawAmber/drawRazor. BROTHERS still carry TMNT `weapon` fields (bo/katana/sai/nunchaku) and drawWeaponIcon exists | Med (load time on mobile) / Low (dead code) |
| Pizza logic | food pickups still keyed as "pizza"/"slice" internally — invisible to player | Low |
| Missing death anims | fighters & grunts: single `down` frame, blink death; Evil Ryu fades instead of a KO | Med |
| Mobile | same engine gaps as Game A (title-only rotate hint, TTS, no iOS haptics); extra 1.5 MB of unused preloads hurts mobile load | Med |
| Placeholder text | "STAGES 2-12: COMING SOON", "COMING SOON!" loader, Stage 1 outro text-only | Med |
| Debug | `?debug` hook shipped | Low |

---------------------------------------------------------------------

## FINAL RANKED LIST

### Game A — Shell Shock Live
**High**
1. Krang android + flying fist code-drawn (L14) — known, in progress.
2. L3 Gulch Gator: tinted ramrod + code-drawn gator head pasted on (worst visual mismatch).
3. L2 Brickjaw, L5 Grimwale, L7 Rustmaul (tinted ramrod) and L4 Jetwash, L6 Cold Front (tinted gunner + code jetpack/tank) — known.
4. **L8 Razorback reuses the L1 Razor sheet (4 frames, scaled + tinted)** — not in the known list.
5. **L1 mid-boss Scorcher = tinted ramrod**; L15 Foot Elite = tinted ninja grunts.
6. L14 outro Shredder cameo = tinted ninja sheet + code helmet/cape (level15_shredder.png exists).
7. Whole grunt roster = 2 sheets (ninja, gunner) re-hued per level; no themed enemies per level.
8. Missing boss death frames (L8, L10, L11, L15 Shredder rotate idle 90°); players/grunts have a single down frame.
9. Players only 6–7 frames; specials have no painted poses.
10. HUD P1 portrait is a generic code-drawn turtle face; boss bar has no portrait.
11. One boss music track transposed for all 14 levels.

**Med**
- Big code-drawn vehicles/props: L4 cars/trucks/big rig + motorbikes, L5 forklift/cranes, L6 snowplow, L7 crusher/magnet/conveyor, L11 outlaw car, L12 flying traffic, L14 Mousers/modules/turrets.
- Engine props (barrel/crate/trash/cone) and pizza/slice pickups, hoverboards: all code.
- Code-drawn hazards in every level (manholes, hydrants, geysers, waves, icicles, lasers, spikes, acid, chasms, meteors, vats…).
- Code-drawn outro scenes: L9 ship, L10 desert + train, L12 alien sky, L14 brain-walker, L15 sunrise.
- Title logo, night-skyline backdrop and stage map all code-drawn.
- L4 reuses one bg for both sections; L2 no boss-arena bg.
- TTS voice barks; synth-only SFX; mobile gaps.

### Game B — SF World Brawl
**High**
1. Stages 2–12 not built: 11 stages, 11 bosses, backgrounds, enemies all missing.
2. 5 grunt types share one untinted scout sheet (+ karateka for heavy/gunner); look identical.
3. Specials have no painted poses (Electric Thunder uses the hurt frame, Lariat/Yoga Fire use idle); fighters only 6 frames.
4. Music is Shell Shock's tracks (boss = TMNT boss tune re-keyed).

**Med**
- Props (dummy/shoji/scrolls) and food pickups code-drawn.
- Title logo (code pixel font) and TMNT night-city backdrop on title + map; map is circles.
- Select/HUD portraits are just crops of idle frames; no boss portrait.
- Stage 1 outro is text-only.
- 1.5 MB of unused TMNT preloads + TMNT dead code/strings; TMNT turtle used as fighter load fallback.
- Hadouken/Sonic Boom/Yoga Fire projectiles are gradient code (could be painted).
- Synth SFX/TTS, no KO animations, same mobile gaps.
