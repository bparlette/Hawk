# Lanternport — Mobile HUD Budget Audit (390×844)

## House Rule & Objective
The persistent HUD must occupy **≤ ~15%** of a phone screen viewport (measured at standard mobile viewport 390×844 headless).

## Audit Methodology
- **Viewport:** 390 × 844 px (total viewport area = 329,160 px²).
- **Environment:** Headless Chromium rendering `/games/lanternport/index.html` with mobile touch styles active (`.touch` class enabled on touch devices, collapsing desktop help overlay).
- **Measurement:** Exact DOM bounding box (`getBoundingClientRect()`) for each persistent on-screen element under active gameplay conditions (active hero card, heat lanterns + cooldown bar, mission goal banner, minimap radar).

## Measurement Table

| Element ID | Description | Position (x, y) | Dimensions (w × h) | Area (px²) | Viewport Coverage (%) |
|---|---|---|---|---|---|
| `#who` | Hero name, title & glim count | (16, 14) | 131 × 60 | 7,934 | **2.41%** |
| `#heat` | Heat lanterns, cooldown meter, watch alert | (230, 14) | 144 × 65 | 9,360 | **2.84%** |
| `#goal` | Active mission objective banner | (70, 92) | 250 × 36 | 9,094 | **2.76%** |
| `#map` | Circular minimap / compass radar | (14, 710) | 118 × 118 | 13,924 | **4.23%** |
| `#help` | Desktop controls overlay | *(hidden)* | 0 × 0 | 0 | **0.00%** (hidden on touch) |
| `#prompt` | Context action prompt (intermittent) | *(hidden)* | 0 × 0 | 0 | **0.00%** |
| `#speed` | Vehicle speedometer (intermittent) | *(hidden)* | 0 × 0 | 0 | **0.00%** |

- **Total Persistent HUD Area:** 40,312 px²
- **Total Persistent HUD Coverage:** **12.25%** of viewport
- **Budget Target:** ≤ 15.00%
- **Status:** **PASS** (well within the ≤ 15% phone screen budget).

## Screenshot Reference
Screenshot captured at 390×844 viewport:
`games/lanternport/audit-assets/hud-390x844.png`
