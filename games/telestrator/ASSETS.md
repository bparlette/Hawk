# Assets — telestrator

| Asset | Source | License | How used |
|---|---|---|---|
| Anton (display font) | Google Fonts — https://fonts.google.com/specimen/Anton | SIL Open Font License 1.1 | Headlines, banners, big numbers |
| Oswald (UI font) | Google Fonts — https://fonts.google.com/specimen/Oswald | SIL Open Font License 1.1 | Buttons, labels, body text |

Fonts are loaded from the Google Fonts CDN at runtime (no local binary ships).
If the CDN is unreachable the pages fall back to Arial Black / Arial Narrow —
all layout and behaviour is unchanged.

## Procedural / self-made (no external asset)
- All sound effects are synthesized live with WebAudio (impact "thock", UI ticks) — no audio files.
- All visual effects (light washes, confetti, glows, wipes) are rendered in code on canvas/CSS.
- The camera-off fallback "gameplay" feed is an original animated scene drawn in
  code (app.js `drawGame`) — it exists so the replay buffer has a moving source
  to capture when no camera is available. It is a demo source, not shipped art.
- The marker strokes are drawn by the user; the marker glow is a canvas shadow effect.
