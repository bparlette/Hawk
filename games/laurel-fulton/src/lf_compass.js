// Compass arrow (easy-five feature 4): a small arrow orbiting the player's car, pointing at
// the current rally target. Pure target selection lives here so it is spec-testable; main.js
// only draws. Priority, by game phase:
//   rally running   -> the nearest undone house stop (the same pick drawMissionHud makes)
//   finale run      -> the meetup (Atholton HS in Laurel) once every stop is done
//   rally complete  -> the night-party house while the party is on (venue anchor)
//   otherwise       -> no target, no arrow (hidden — never a decorative widget)
// The party venue only counts inside the current map's bounds: College Park loads Laurel's
// party data (a known leak), and its Laurel coordinates fall outside the CP map — the arrow
// must never point off-world there.
export const COMPASS = {
  radius: 104,   // screen px from the car centre. The drift-bank readout owns the slot above
                 // the car (pill y-64..-40, up to ~75 px wide; popups rise from y-54 to ~y-91):
                 // at radius 104 the arrow clears the pill vertically (top reach -97) and
                 // horizontally (crosses the pill's y-band at |x| ~ 90 > 75). Never shrink
                 // this below 100 without re-checking drawDrift in main.js.
  arriveDist: 60,   // world units (6 m): at the target, the arrow hides
};

export function compassTarget(M, party, c, bounds) {
  if (!c) return null;
  if (M && M.beat) return null;                       // the arrival beat owns the screen
  if (M && !M.complete) {
    const todo = (M.stops || []).filter(s => !s.done);
    if (todo.length) {
      let best = todo[0], bd = Infinity;
      for (const s of todo) { const d = Math.hypot(s.x - c.x, s.y - c.y); if (d < bd) { bd = d; best = s; } }
      return { x: best.x, y: best.y, kind: 'house' };
    }
    if (M.meet && M.meet.pos) return { x: M.meet.pos[0], y: M.meet.pos[1], kind: 'meet' };
    return null;
  }
  if (party && party.active && typeof party.venue === 'function') {
    const v = party.venue();
    if (v && Array.isArray(v.world)) {
      const x = v.world[0], y = v.world[1];
      if (!bounds || (x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1))
        return { x, y, kind: 'party' };
    }
  }
  return null;
}
