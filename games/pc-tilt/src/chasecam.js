// chasecam.js — the painted OutRun chase camera's shared maths (OPEN ROAD v2). Pure functions
// and constants only: openroad.js steps the state (it lives on the sim, so the director's
// re-sim reproduces the camera frame for frame), render.js composites the picture, main.js
// remaps the stick. Nothing here touches the DOM or the sim.
//
// THE PICTURE (the owner's frame: a red convertible from directly behind, low and large, the
// road converging to a vanishing point, sky + pale silhouettes across the top):
//   - the world is rendered once, heading-up, into an offscreen FRAME (560x1020 view units);
//   - the frame is composited onto the portrait screen in 24 horizontal strips: each strip is
//     squashed vertically (the oblique tilt) and shifted by the course's elevation profile —
//     elevation(ahead) - elevation(here) — so straights rise toward the horizon and the road
//     falls away past a crest. Cars and props ride the same strips: no floating sprites.
//   - above the horizon line: a painted sky gradient in the dusk grade + a silhouette strip.
// Portrait adaptation (420x860): sky band = top ~31.5% of the screen, the car anchors ~68%
// down. FREEZE: none of this exists outside the event — sim.chase is null in free roam.

export const CHASE = {
  frameW: 560, frameH: 1020,   // the offscreen world's view size (device 1120x2040 @ DPR 2, under the 2048 cap)
  zoom: 1.12,                  // chase framing: a touch wider than the top-down 1.0
  squash: 0.58,                // vertical squash of the world at full blend (the oblique tilt)
  anchor: 0.68,                // the car sits 68% down the screen at full blend
  horizon: 0.315,              // the horizon line (and sky band) at full blend, fraction of screen height
  strips: 24,                  // horizontal strips per frame (phone perf cap)
  elevGain: 1.15,              // screen px of shift per world unit of elevation difference
  lead: 27,                    // the frame's focus rides this far ahead of the car (puts the car at frame y ~540)
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
