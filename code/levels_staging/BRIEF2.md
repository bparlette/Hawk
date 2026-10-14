# Levels 9–15 brief (Shell Shock Live) — "Acts III & IV"
Same rules as /workspace/work/levels_staging/BRIEF.md (read it), EXCEPT:
- The user now WANTS the licensed TMNT bosses by name (free fan game). Brothers stay Lenny/Rafe/Miko/Donny, Amber stays Amber.
- Story: after Level 8 (Razorback's fortress, reactor core), the core's blast tears a temporal rift. Act III = time travel (L9–12), Act IV = final siege (L13–15). Each outro line leads to the next level. Level 15 is the true finale (THE END, all brothers + Amber celebrate); L9–14 must NOT say THE END.
- Art: no backgrounds exist for these levels. Generate your own with the generate_image deferred tool (deferred_tool describe first), matching the comic-painterly pixel style of /workspace/work/ss_assets/*.jpg (see /workspace/work/ss_assets_preview.jpg): a side-scrolling strip ~1700–1900x512 (re-cut so it tiles seamlessly) + a one-screen boss arena ~878x512. Leave a clear walkable floor band (document FLOOR_TOP/FLOOR_BOT in NOTES). Downscale/convert to JPG < ~400KB each.
- Bosses: make each boss read as its character (silhouette, colors, signature weapon). Options: tint/scale/overlay existing atlas sprites and draw accessories on canvas via hooks, or generate a sprite sheet (solid chroma background you key out to PNG; keep < 300KB). Must animate at least idle/walk/attack/hit/KO poses.
- Copy level8.js into your private test copy too if it exists in staging (for chain prefetch), but test ?level=N directly.
- The engine is being upgraded in parallel (pickups, special move, throws, props; API v1.1 additive). Use only API v1 so you stay compatible; list wished-for hooks in NOTES.md.
- Deliver to /workspace/work/levels_staging/levelN/ exactly as BRIEF.md says (levelN.js, images, 3+ shot_*.png, NOTES.md). Never touch shared source/deploy; never deploy.
- If you loop on the same failure more than twice, stop and report what you have.
