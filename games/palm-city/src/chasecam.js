// chasecam.js — the painted OutRun chase camera's shared maths (OPEN ROAD v2). Pure functions
// and constants only: openroad.js steps the state (it lives on the sim, so the director's
// re-sim reproduces the camera frame for frame), render.js composites the picture, main.js
// remaps the stick. Nothing here touches the DOM or the sim.
//
// THE PICTURE (the owner's frame: a red convertible from directly behind, low and large, the
// road converging to a vanishing point, sky + pale silhouettes across the top):
//   - the world is rendered once, heading-up, into an offscreen FRAME (560x1020 view units);
//   - the frame is composited onto the portrait screen in horizontal strips under a TRUE
//     perspective warp (see compositeChase in render.js): the source row for a screen row
//     follows a ground-plane depth curve — far rows are compressed toward the horizon, near
//     rows stretched — and each strip also resamples HORIZONTALLY, sampling a wider slice of
//     the frame near the horizon and a narrower slice near the car, so the road's edges
//     converge to the vanishing point instead of running parallel. Strips share exact
//     boundary source rows, so the warp is continuous and curves don't tear. Each strip is
//     also shifted by the course's elevation profile — elevation(ahead) - elevation(here) —
//     so straights rise toward the horizon and the road falls away past a crest. Cars and
//     props ride the same warp: no floating sprites.
//   - above the horizon line: a painted sky gradient in the dusk grade + a silhouette strip.
// Portrait adaptation (420x860): sky band = top ~31.5% of the screen, the car anchors ~68%
// down. FREEZE: none of this exists outside the event — sim.chase is null in free roam.

export const CHASE = {
  frameW: 560, frameH: 1020,   // the offscreen world's view size (device 1120x2040 @ DPR 2, under the 2048 cap)
  zoom: 1.12,                  // chase framing: a touch wider than the top-down 1.0
  squash: 0.58,                // vertical squash of the world at full blend (the oblique tilt; still scales the elevation shift + the blend-in path)
  anchor: 0.68,                // the car sits 68% down the screen at full blend
  horizon: 0.315,              // the horizon line (and sky band) at full blend, fraction of screen height
  strips: 56,                  // horizontal strips per frame (was 24: the perspective warp needs fine steps — coarser strips kink the painted texture at every boundary into visible bands)
  elevGain: 1.15,              // screen px of shift per world unit of elevation difference
  lead: 27,                    // the frame's focus rides this far ahead of the car (puts the car at frame y ~540)
  // Perspective warp (compositeChase): ahead-distance at screen depth o px below the horizon is
  //   D(o) = perspFar * (oa - o) / (oa + perspM * o),   oa = anchor's depth below the horizon.
  // D(oa) = 0 at the car, D(0) = perspFar at the horizon; |dD/do| is ~15x larger at the horizon
  // than at the screen bottom, which is the compression that makes the far field bunch up.
  perspM: 1.5,                 // depth-curve strength: bigger = harder compression at the horizon, more stretch at the bumper (2.3 stretched the near field ~5x per strip — the texture tore into bands; 1.5 keeps ~28x -> ~9x horizon:bottom density ratio)
  perspFar: 545,               // frame px ahead of the car shown at the horizon (the frame's car row sits ~540 from its top)
  perspD0: 170,                // horizontal resample: source width at depth D is vw * (D + perspD0) / perspD0 — 1:1 at the car, ~1.33x (frame-capped) at the horizon, ~0.47x at the bottom edge. Horizontal narrowing carries the convergence; it doesn't band, so it can push harder than the vertical curve
  // === HERO CAR HOOK (STAND-IN — NOT the final look) ===
  // The Nov 16 frame wants the hero car drawn from DIRECTLY BEHIND, low and large. That needs a
  // rear-view sprite, which does not exist yet (separate asset task). Until it lands, the
  // composite draws the player's existing TOP-DOWN sheet cell at heroScale over the anchor —
  // a framing stand-in ONLY, so size/position can be judged in captures. When the rear-view
  // asset arrives: point drawChaseHeroCar (render.js) at it, drop the rotation, and delete
  // this note. heroCar=false disables the hook (the frame's own car shows as before).
  heroCar: true,
  heroScale: 2.7,              // stand-in size: x the sheet cell's world size (the frame shows it at ~zoom, so ~2.4x on screen)
};

// The course's gentle elevation profile: two long sine swells over route distance (world
// units). Purely presentational — the sim's ground stays flat; only the picture rises/falls.
export function elevAt(s) {
  return 15 * Math.sin(s * (Math.PI * 2 / 1450) + 0.6) + 8 * Math.sin(s * (Math.PI * 2 / 617) + 2.1);
}

// smoothstep of the 0..1 blend, shared by every chase visual so they all arrive together
export function easeBlend(b) {
  b = b < 0 ? 0 : b > 1 ? 1 : b;
  return b * b * (3 - 2 * b);
}

// Remap a stick input from screen space into world space for a heading-up camera.
// viewUp = the world direction currently pointing at the top of the screen. Stick up must
// drive the car toward viewUp (screen-up = forward); stick right = viewUp + 90 degrees.
// Keyboard input is NOT remapped: up/left/right are already chase-natural (throttle/steer).
export function chaseStick(inp, viewUp) {
  if (!inp || !(inp.jm > 0.15)) return inp;
  const a = Math.atan2(inp.jy, inp.jx), d = viewUp + a + Math.PI / 2;
  return { ...inp, jx: Math.cos(d) * inp.jm, jy: Math.sin(d) * inp.jm };
}
