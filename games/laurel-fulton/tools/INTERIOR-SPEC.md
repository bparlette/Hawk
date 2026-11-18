# INTERIOR-SPEC — the cutaway standard (Moth, Nov 17)

Every walk-in house interior (tools/interior_build.py → data/interiors/<id>.json →
src/lf_interior_render.js) ships at this standard in ONE build — no separate polish pass.
Brad's split-foyer (task L7) is the reference build. Change this spec first, then the code.

1. **Camera — fit-height.** The whole house height (lowest floor − 0.3 to top floor +
   ceiling + 1.6) fits in ~82% of the screen height: k = clamp(vh·0.82 / span, 54, 96),
   gy = vh·0.05 + topZ·k. (74% was tried first and left ~40% of the frame as empty earth
   under a split-foyer's sunk lower level; 82% keeps the earth to a band.) The camera pans x to follow the hero and NEVER follows vertically —
   both floors stay in frame (the dollhouse rule). People land ~1/5 of the screen tall.
2. **Rooms read as rooms.** Wall fill in the room's `wall`; the floor surface is a band in
   the room's `floorc` on top of the slab, with grain: wood = streaks, kitchen = tile seams,
   lower level = plank seams. The lower level keeps its wood panelling; upstairs keeps the
   wallpaper stripe.
3. **Labels last, on pills.** Room names are drawn AFTER everything else, centred in the
   room, on a dark pill (rgba(27,20,48,0.66), #ffe4b0 text). Nothing may clip or cover them —
   if a label can be overlapped by a slab, a prop or a resident, the draw order is wrong.
4. **Light is a pass, not an accident.** After the residents, composite 'lighter':
   the fireplace washes its room (radial, ~2.4 m, flickering on two sines; the firebox itself
   keeps the ember-glow rule — glow + smoke, never flame tongues), every lamp throws a warm
   pool (~1.15 m), the TV spills cool light (~1.5 m, synced to its screen flicker).
5. **Life.** Teter ROCKS in her recliner (±0.035 rad, ~0.9 Hz sine, pivoting at the seat) on
   top of her breathing bob. Dogs wag (faster when patted), the TV flickers, the fire breathes.
   A still cutaway is a failed cutaway.
6. **Contact shadows ground everything.** A soft ellipse under every standing prop (couch,
   fridge, recliner, fireplace, weights, table, plant, lamp), under Teter, under each dog,
   under the hero. Nothing floats.
7. **Prop vocabulary** (statement words the builder + renderer both know): couch, tv, cooler,
   fridge, recliner (auto-added for `mom`), weights, fireplace (+ `mantle-beers N` cans that
   really deplete), rug, picture, lamp, plant, table. Placement comes from the builder's
   per-kind PLACE map, never from statement order. The picture window gets curtains + a
   valance with a brass rail.
8. **Acceptance.** tools/spec_l7.mjs green (incl. the byte-for-byte statement reproduction)
   AND tools/l7_shots.mjs shots viewed full-size at phone size: whole house in frame, labels
   readable on their pills, floors visibly different per room, firelight on the lower room,
   Teter mid-rock. A spec pass without viewed shots is not acceptance.

## Addendum — L7 remainder (Nov 18)
9. **The baked layer.** The static shell (roof, wall gradients + pattern + baseboard + crown, floors, windows, slabs, stairs, the
   front door) is painted ONCE per (kit, zoom, dpr) into an offscreen canvas and blitted each frame; furniture, residents and the
   light pass stay live on top. **Honesty: this is a PAINTED pass, NOT a Blender bake** — `bpy`/Blender is not available in the
   environment this was built in, and nothing here was rendered by it. `box()` props carry a painted gradient + highlight edge.
10. **More prop vocabulary:** computer (screen text from the statement — `eDonkey`), cdwriter, bed, speaker, chandelier, plus
    kit-placed `door` (Brian's bedroom, labelled) and `cellardoor`. Rooms may carry `h` (a two-story entryway is one tall room).
11. **House type `two-story-entry`** (Rigg's): flights that overlap a floor are `press` links — push UP at the foot / DOWN at the
    top (straight up/down works too); a hint pill says so. The house BEAT is data: `dad` (yells) + `son` (comes down the stairs).
12. **Guests:** crew CPUs home with a kit (CrewWorld `B.inside`, snapshot [8]; solo: car parked at the house) are drawn at the kit's
    `cpuIdle` spot with a beer, hue-shifted from the hero sprite. Kit `teter.lines` are said one after another (word-wrapped bubble).
