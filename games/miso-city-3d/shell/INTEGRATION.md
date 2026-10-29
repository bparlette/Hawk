# Miso City — Premium Shell: Integration Contract

The shell is a self-contained DOM overlay (`shell.css` + `shell.js`, no framework,
no build step) that turns the scene's cold open into a film start: a loading veil,
a title moment over the opening shot, a tap-for-sound pill, a fullscreen button,
and a permanent micro-caption once the title releases.

## Files

| File | Role |
| --- | --- |
| `shell.css` | All overlay styling. Namespaced `.miso-*`, safe next to scene CSS. |
| `shell.js` | Builds the overlay DOM, rain-on-veil canvas, state machine, `window.Shell` API. |
| `demo.html` | Standalone judging page (placeholder gradient scene). Not shipped. |

## DOM placement & z-order

1. Wrap the scene in a positioned stage and mark it `data-miso-stage`:

   ```html
   <div id="stage" data-miso-stage style="position:relative">
     <canvas id="scene"></canvas>
     <!-- shell.js appends <div class="miso-shell"> here, as the last child -->
   </div>
   ```

   The shell positions itself `absolute; inset: 0` inside the stage, so it tracks
   the embed frame at any size (itch embed 960×540, fullscreen, portrait phone).
   If no `[data-miso-stage]` element exists, it mounts on `<body>` as `position: fixed`
   (acceptable fallback; the stage is the correct integration).

2. Inside the shell root (z-index 50 within the stage), paint order is:

   | Layer | z-index | Pointer events |
   | --- | --- | --- |
   | permanent caption | 20 | none |
   | title card | 30 | none |
   | sound pill / fullscreen button | 35 | auto (buttons only) |
   | loading veil | 40 | auto, only until `Shell.ready()` lifts it |

   The shell root itself is `pointer-events: none`; the scene is never blocked
   except by the veil during load, which is the point of a veil.

3. The scene should **remove its own built-in caption** — the shell provides the
   permanent one ("MISO CITY · A RAINY NIGHT WALK", bottom-centre) once the title
   releases. If the scene keeps a caption too, they will double up.

## Font loading

Recommended: put the Google Fonts links in `<head>` (render-earlier, no FOUT jump
on the veil's title):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link data-miso-fonts rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Jost:ital,wght@0,300;0,400;1,300&display=swap">
```

- **Cinzel** 500/600 — the display face (veil title + title card). Engraved Roman
  capitals; the classic film-title look.
- **Jost** 300/400 (+italic 300) — letterspaced geometric sans for the subtitle,
  caption, veil note, and pill label.
- `shell.js` injects the identical link (tagged `data-miso-fonts`) if the page
  didn't include it, so a bare `<script src="shell.js">` still works — the head
  link is simply the faster, preferred path. Font stacks degrade to
  Playfair Display / Georgia (serif) and Avenir/Segoe (sans) if the CDN is
  unreachable, never to a bare default.

## API

Load order: `shell.css` in `<head>`, `shell.js` at the end of `<body>` (it
auto-mounts on DOMContentLoaded or immediately if the DOM is ready). All methods
are idempotent and safe to call early, late, or twice.

```js
Shell.ready()
```
Call once the scene's first frame is actually renderable (assets decoded, first
render done). The progress line completes, the veil fades (~0.9 s), the title
card settles over the opening shot, and the sound pill + fullscreen button fade
in. Until this is called, the veil's progress line creeps to 72% and waits.

```js
Shell.startWalk()
```
Call when Miso actually starts moving. The title fades out and the permanent
micro-caption fades in. If the scene forgets, the shell releases the title itself
4.6 s after `ready()` — but calling it on the real first step is the designed beat.
Calling `startWalk()` before `ready()` implies `ready()`.

```js
Shell.setZone('amber' | 'teal' | 'pink')
```
Retints the shell accent — title glow + rule, progress line, sound-pill ring,
caption dot — over ~0.9 s. Call it when the street's district changes. Unknown
names are ignored; the default zone is `amber`. Match it to the scene's color
script zones so chrome and grade shift together.

```js
Shell.setProgress(0..1)   // optional
```
Drive the veil line determinately from the loader (e.g. fraction of assets
decoded). First call switches the line out of its CSS creep animation. Values
are clamped. `ready()` still completes the line to 100%.

```js
Shell.onSoundTap = function () { /* unlock + start audio */ };
```
Assign any time before the tap (typically right after creating the audio
module). The pill appears with the title moment, labelled "sound", and fades out
**permanently** on first tap; the callback fires exactly once, inside a
try/catch so an audio failure can never break the shell. Browser autoplay rules
are why this exists: the tap *is* the user gesture the audio unlock needs. On
iPhone, the callback is also where `navigator.audioSession.type = 'playback'`
should be set. If never assigned, the pill still dismisses itself on tap.

```js
Shell.mount(el)   // optional
```
Re-mount the overlay into a specific element (it otherwise uses
`[data-miso-stage]` or `<body>`). Rarely needed.

## Behaviour notes

- **Fullscreen button** (bottom-right): calls `requestFullscreen()` on the
  stage element. Inside itch, the embed iframe already carries `allowfullscreen`
  (fullscreen is enabled for this project), so it works; if a host refuses, the
  button quietly does nothing. Toggle again to exit.
- **Sound pill** (bottom-left) and **fullscreen** sit in opposite corners; the
  caption is bottom-centre and lifts above the pill row on narrow portrait
  frames (max-aspect-ratio 3/4 breakpoint).
- **`prefers-reduced-motion`**: fades collapse to cuts, the letterspacing
  "settle" animation is disabled, and the veil rain does not start.
- **Veil rain**: one small canvas, ≤110 streaks, DPR capped at 1.5, cancelled
  the moment the veil lifts. No cost to the scene after load.
- **Performance**: after the title releases, the shell is three static DOM
  nodes (caption + two buttons). No timers run; the 4.6 s title fallback is
  the only timeout and it is cleared by `startWalk()`.

## Sequence (the intended first 30 seconds)

```
t=0      page opens → veil up, rain, progress creeping
ready()  first frame renderable → line completes, veil fades, TITLE over the
         opening shot, sound pill + fullscreen fade in
~4 s     startWalk() → she steps off, title dissolves, micro-caption remains
zones    setZone() as districts change → chrome retints with the grade
tap      onSoundTap() → audio unlocks, pill gone for good
```
