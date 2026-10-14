# L8-15 restructure, phase 1 (design + art), 2026-10-08
- DESIGN: sections appended to ../DESIGN.md (the file did not exist yet, so the append created it); identical copy in DESIGN_L8-15.md.
- Zone-2 bgs: gen/*z2*.png -> fitbg.py (floor-top aligned to zone 1 floor[0]*512/224, 64 px wrap fade) -> out/levelN_*.jpg. Floor checks: view/floors0.jpg, floors1.jpg.
- Twist art: gen/r815_*twist*.png -> pack.py (kit.py key/comps/pack) -> out/levelN_*.png + out/meta.json. Ronin mini-boss: geodesic split of the merged lunge/hurt blob + blade transfer + thigh gap fill (pack.py).
- Contact sheets: contact/L8..L15_contact.jpg (row 1 zone1 | twist art | zone2 | arena; row 2 twist art staged at game scale with the floor-top line).
- Nothing installed into deploy/ or built/; no levels/*.js or index.html edits.
