# WASTED SLAM — asset provenance

| Asset | File | Source | License |
|---|---|---|---|
| Anton font (banner typeface — generic condensed display, NOT any game's typeface) | `assets/anton.woff2` | Google Fonts — https://fonts.google.com/specimen/Anton (file: fonts.gstatic.com/s/anton/v27) | Apache License 2.0 |
| US $100 bill, obverse, Series 2009 (flutter-bill texture) | `assets/bill100.png` | Wikimedia Commons — https://commons.wikimedia.org/wiki/File:USA_100_Dollar_Bill_Series2009_Obverse.png | Public domain (work of the US federal government) |
| Bass thud / impact sound | — (synthesized live with WebAudio oscillators + filtered noise) | Original code | — |
| Greyscale grade, vignette, banner, shake | — (CSS/Web Animations, original code) | Original code | — |
| Falling-cash loop (full-screen money rain during the slam) | `assets/falling-cash.mp4` | Owner-supplied generated video (Nov 16): $100 bills falling on pure black, composited live with CSS `mix-blend-mode: screen` over the camera layer, fading in with the banner and out at clear | Owner-provided; transcoded HEVC → H.264 (yuv420p, faststart, audio stripped) by Moth for browser compatibility — the HEVC original is kept at `~/workspace/ar-photoreal/falling-cash.mp4` |

**Retired Nov 16:** the DOM flutter-bills layer (`THEME.flutter = false`). The
video loop already rains ~25 photoreal bills; the flat textured PNG bills on
top of it read as a second, cheaper effect fighting the first. The flutter
code remains in the page behind the THEME flag for A/B (`?flutter=1`).

No Rockstar/GTA art, fonts, or logos are used. "WASTED"/"BUSTED" are rendered as plain words in Anton, an unrelated free font.
