# Wrecked TV — asset provenance

Theme pack: **leonida** (in-code `THEME` object — condition names, dimming curve, toast copy).

| Asset | Source | License |
|---|---|---|
| `assets/crack1.png` … `crack5.png` (cumulative spiderweb crack overlays) | **Procedural fallback** — generated in-house with `tools/gen_cracks.py` (PIL: seeded radial/concentric fracture synthesis, dual dark+bright line pass). Searched Wikimedia Commons and OpenGameArt for a CC0 alpha crack texture first; nothing suitable exists there (only photographs and unrelated PDFs), so the textures were synthesized instead of using a non-clean source. | Original work |
| Fonts (Anton, Barlow Condensed) | Google Fonts | SIL OFL 1.1 |
| Edge smoke at stages 4–5 | `assets/smoke-drift.mp4` — owner-supplied generated video (Nov 16): smoke wisps on pure black, extracted from the smoke segment (20–30 s) of the owner's three-part render, crossfade-looped; four screen-blended `<video>` copies sit inside the quad-mapped stage (bottom edges at stage 4, top edges join at stage 5, mirrored for variety) | Owner-provided; extracted + transcoded HEVC → H.264 by Moth |
| Sparks / smoke particles | In-app canvas particles (original). The smoke puffs are now the fallback: `?smoke=particles` restores them; default is the video (`window.__smokeMode`) | — |
| Glass-break / thud sounds | Synthesized live with WebAudio (original, no samples) | — |

No Rockstar/GTA assets or marks.
