// lf_foot.js — the on-foot player, ported from Palm City's stepPlayerFoot/punch
// (owner, Nov 17: Laurel gets Palm City's controls — same input, same numbers).
// Pure logic: main.js owns the transitions and the drawing (lf_fx.drawPed).
// Palm City numbers, same unit scale: run 74 u/s at full stick, walk 30 + jm*50,
// pose cycle [0,1,2,1] every 9 units walked, punch 0.26 s with a 100 u/s lunge
// while punchT > 0.14, punch cooldown 0.42 s, get-in radius 40 (Palm City's JACK range).
export const FOOT = { run: 74, walkBase: 30, walkGain: 50, punchT: 0.26, punchCd: 0.42, lunge: 100, enterR: 40, exitV: 60 };

export function createFoot(who) {
  return { who, active: false, x: 0, y: 0, h: 0, px: 0, py: 0, walk: 0, pose: 1, punchT: 0, punchCd: 0 };
}

// step out of the car: driver's side, just clear of the body, facing the car's way
export function exitCar(F, car) {
  const a = car.h - Math.PI / 2, d = (car.wid || 20) / 2 + 7;
  F.x = car.x + Math.cos(a) * d; F.y = car.y + Math.sin(a) * d;
  F.h = car.h; F.px = F.x; F.py = F.y; F.walk = 0; F.pose = 1; F.punchT = 0; F.punchCd = 0; F.active = true;
  F.z = 0; F.vz = 0; F.air = false; F.climb = null; F.land = 0;   // L5 heights (lf_climb.js): you step out at street level
}

export function nearCar(F, car) { return !(F.z > 4) && Math.hypot(car.x - F.x, car.y - F.y) < FOOT.enterR; }   // L5: not from up on a roof

// one fixed step on foot. inp is Palm City's {jx, jy, jm, keys, punch}.
// Returns 'punch' on the step a punch starts, else null.
export function stepFoot(F, dt, inp) {
  if (F.punchCd > 0) F.punchCd -= dt;
  if (F.punchT > 0) {
    F.punchT -= dt;
    if (F.punchT > 0.14) { F.x += Math.cos(F.h) * FOOT.lunge * dt; F.y += Math.sin(F.h) * FOOT.lunge * dt; }
  }
  let jx = inp.jx, jy = inp.jy, jm = inp.jm;
  const k = inp.keys || {};
  if (k.up || k.down || k.left || k.right) {
    jx = (k.right ? 1 : 0) - (k.left ? 1 : 0); jy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    jm = Math.hypot(jx, jy) ? 1 : 0;
    if (jm) { const l = Math.hypot(jx, jy); jx /= l; jy /= l; }
  }
  if (jm > 0.12) {
    const sp = jm > 0.65 ? FOOT.run : FOOT.walkBase + jm * FOOT.walkGain;
    F.h = Math.atan2(jy, jx);
    F.x += Math.cos(F.h) * sp * dt; F.y += Math.sin(F.h) * sp * dt;
    F.walk += sp * dt;
    F.pose = [0, 1, 2, 1][Math.floor(F.walk / 9) % 4];
  } else F.pose = 1;
  if (inp.punch && !(F.punchCd > 0)) { F.punchT = FOOT.punchT; F.punchCd = FOOT.punchCd; return 'punch'; }
  return null;
}
