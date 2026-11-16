# Assets — scoreboard

| Asset | Source | License | How used |
|---|---|---|---|
| Anton (display font) | Google Fonts — https://fonts.google.com/specimen/Anton | SIL Open Font License 1.1 | Headlines, banners, big numbers |
| Oswald (UI font) | Google Fonts — https://fonts.google.com/specimen/Oswald | SIL Open Font License 1.1 | Buttons, labels, body text |

Fonts are loaded from the Google Fonts CDN at runtime (no local binary ships).
If the CDN is unreachable the pages fall back to Arial Black / Arial Narrow —
all layout and behaviour is unchanged.

## Owner-supplied video (Nov 16)
| Asset | Source | License | How used |
|---|---|---|---|
| `assets/confetti-burst.mp4` | Owner-supplied generated video (Nov 16): metallic gold/pink/cyan confetti on pure black, extracted from the confetti segment (30–40 s) of the owner's four-part render | Owner-provided; extracted + transcoded HEVC → H.264 by Moth | Winner-takeover celebration: screen-blended full-screen `<video>` (`window.__confettiMode`: 'video' default — A/B showed the video alone reads cleanest; 'layer' / 'canvas' via `?confetti=` restore the procedural pieces) |

## Procedural / self-made (no external asset)
- All sound effects are synthesized live with WebAudio (impact "thock", UI ticks) — no audio files.
- All other visual effects (light washes, glows, wipes) are rendered in code on canvas/CSS.
- The winner crown is an original hand-drawn inline SVG in index.html.
- Canvas confetti is procedural particles in THEME.confetti colours, kept behind the `?confetti=` A/B flag.
