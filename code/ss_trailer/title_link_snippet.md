# "WATCH TRAILER" button for the Shell Shock Live title screen

Target file: `/workspace/built/sites/2a3b54c1-7d13-4c6f-ac4d-d0672d22caaf/index.html`
(merge only after `shellshock-polish-levels` is done with it). It's a DOM button styled like the existing `#fsbtn`,
so it stays crisp and tappable on iPhone and doesn't touch canvas rendering. It shows only while `STATE.scene === "title"`,
and it stops the pointer event so tapping it doesn't also count as a tap on PUSH START.

## 1) CSS: add inside the existing `<style>` block, right after the `#fsbtn` rules (~line 70)

```css
  #trailerbtn { position: fixed; z-index: 50; left: 50%; transform: translateX(-50%);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
    display: none; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px;
    border: 2px solid #ffd23c; background: rgba(10,10,14,.72); color: #ffd23c; text-decoration: none;
    font: 800 14px/1 system-ui, -apple-system, sans-serif; letter-spacing: 2px;
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); touch-action: manipulation; }
  #trailerbtn:active { transform: translateX(-50%) scale(.94); }
  html.on-title #trailerbtn { display: inline-flex; }
```

## 2) HTML: add right after the `<button id="fsbtn" ...>...</button>` line (~line 76)

```html
<a id="trailerbtn" href="https://shellshock-trailer.surge.sh" target="_blank" rel="noopener" aria-label="Watch the trailer">&#9654; WATCH TRAILER</a>
```

## 3) JS: two small additions inside the main game IIFE

a) In `function frame()`, right after `scene.update();`:

```js
    document.documentElement.classList.toggle("on-title", STATE.scene === "title");
```

b) After the `addEventListener("keydown", ...)` input block (anywhere after `canvas` is defined):

```js
  { const tb = document.getElementById("trailerbtn");
    if (tb) ["pointerdown", "touchstart", "mousedown"].forEach((ev) => tb.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })); }
```

## Optional: keyboard shortcut on the title screen (T)

In `updateTitle()`, before the `PUSH START` check:

```js
    if (pressed.has("t")) { window.open("https://shellshock-trailer.surge.sh", "_blank"); return; }
```

## Check after merging
- Title screen: button visible bottom-center; tap opens the trailer in a new tab; the game does NOT advance to select.
- Select, stage, and results screens: button hidden.
- Landscape iPhone fill mode: it clears the home indicator (safe-area inset) and doesn't cover "PUSH START" (drawn at y=176 of 224).
  If it overlaps on very short screens, change `bottom` to `top: calc(env(safe-area-inset-top,0px) + 10px); left: 12px; transform: none;`.
