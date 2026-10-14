# Restructure L1-7, phase 1 (art + design) — notes, 2026-10-08
- Design: my sections are appended to ../DESIGN.md under "## Levels 1–7". A copy is in DESIGN_L1-7.md.
- gen/ = raw generations (refs were the zone-1 bgs in ref/; a ref of exactly 2064x512 gives a 2064x512 output, other sizes can come back at odd aspects). build.py turns gen/ into bg/ + props/ + meta.json. contact.py makes contact/LN_contact.jpg.
- Keying: transparent_background output is already RGBA. despill() is applied to every sheet EXCEPT L3 (the water is meant to be green). The L3 gush was painted on magenta (key_mag) because the green key ate the green water. The L6 sheet had panel frame lines, removed with a binary opening (gen/l6_tw_clean.png).
- Nothing in deploy/ or levels/*.js or index.html was touched.
