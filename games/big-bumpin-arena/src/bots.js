// Bots: two simple roles per team. The chaser gets behind the ball and drives it at the far goal; the sweeper
// sits between the ball and its own goal and steps up to clear when the ball comes close. Pure functions of the
// game state plus a little per-bot memory, so bot matches are deterministic. (No donor has working bots:
// ice-bumpers is four humans and carball.io's bot code is dead, so this file is new work.)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
import { inField } from './arenas.js';

export function makeBotMemory(rand) { return { stuck: 0, rev: 0, revSteer: 1, aim: 0, rand }; }

/** Called at every face-off so a bot's shots are not all aimed at the same spot. */
export function botKickoff(mem) { mem.aim = (mem.rand() - 0.5) * 2; mem.stuck = 0; mem.rev = 0; }

// Shunts and power-ups. skill 0..1 scales how often a bot spots the chance.
function tactics(game, car, mem, out, skill) {
  const B = game.M.Body, me = car.body.position, a = car.body.angle, fx = Math.cos(a), fy = Math.sin(a), ball = game.world.ball.body;
  const local = (p) => { const dx = p.x - me.x, dy = p.y - me.y; return { f: dx * fx + dy * fy, r: -dx * fy + dy * fx, d: Math.hypot(dx, dy) }; };
  const foes = game.world.cars.filter((c) => c.team !== car.team).map((c) => ({ c, l: local(c.body.position) }));
  if (mem.rand() > 0.03 + 0.09 * skill) return;                 // reaction time: a bot only sometimes spots the moment, a weak one rarely
  if (car.shuntCd === 0) {
    const side = foes.find((f) => Math.abs(f.l.f) < car.cls.len * 0.55 && Math.abs(f.l.r) < car.cls.wid / 2 + f.c.cls.wid / 2 + 34 && f.c.spinT === 0 && f.c.immune === 0);
    const bl = local(ball.position), dir = car.team === 0 ? 1 : -1, toGoal = Math.sign(-fy * dir) || 1; // which side of me the far goal is on
    if (side) out.shunt = Math.sign(side.l.r) || 1;                                                        // T-bone the car alongside
    else if (Math.abs(bl.f) < car.cls.len * 0.5 && Math.abs(bl.r) < car.cls.wid / 2 + game.cfg.ball.r + 26 && Math.sign(bl.r) === toGoal && Math.abs(fy) > 0.5) out.shunt = Math.sign(bl.r); // barge the ball goalward
  }
  if (!car.item) return;
  const bl = local(ball.position), near = foes.filter((f) => f.l.d < 230).length;
  if (car.item === 'magnet') out.use = bl.f > 0 && bl.f < car.cls.len / 2 + game.cfg.ball.r + 40 && Math.abs(bl.r) < 50;
  else if (car.item === 'shock') out.use = near >= 1 && bl.d < 260;
  else if (car.item === 'cow') out.use = bl.d < 260 || near >= 1;
  else if (car.item === 'harpoon') out.use = bl.f > 120 && bl.d < game.cfg.items.harpoon.range * 0.9 && Math.abs(Math.atan2(bl.r, bl.f)) < 0.8;
  else if (car.item === 'oil') out.use = foes.some((f) => f.l.f < -40 && f.l.f > -260 && Math.abs(f.l.r) < 70);
}

export function botInput(game, car, mem) {
  const cfg = game.cfg, A = game.arena, R = A.bounds, B = game.M.Body;
  const dir = car.team === 0 ? 1 : -1, me = car.body.position, ball = game.world.ball.body, bv = B.getVelocity(ball);
  const mate = game.world.cars.find((c) => c.team === car.team && c !== car);
  const og = A.goals[1 - car.team], oppGoal = { x: og.x, y: og.y + mem.aim * og.half * 0.55 }, ownGoal = { x: A.goals[car.team].x, y: A.goals[car.team].y };
  // lead the ball a little
  const d0 = Math.hypot(ball.position.x - me.x, ball.position.y - me.y), lead = clamp(d0 / (car.cls.maxSpeed * 1.4), 0, 26);
  const bp = { x: clamp(ball.position.x + bv.x * lead, R.left + 20, R.right - 20), y: clamp(ball.position.y + bv.y * lead, R.top + 20, R.bottom - 20) };
  const dMe = Math.hypot(bp.x - me.x, bp.y - me.y), dMate = mate ? Math.hypot(bp.x - mate.body.position.x, bp.y - mate.body.position.y) : 1e9;
  const dOwn = Math.hypot(bp.x - ownGoal.x, bp.y - ownGoal.y);

  let role = car.role;
  if (role === 'sweeper' && (dOwn < 330 || ((bp.x - A.cx) * dir < -60 && dMe < dMate * 0.85))) role = 'chaser';
  let target, turbo = false, arrive = false;
  if (role === 'chaser') {
    let gx = oppGoal.x - bp.x, gy = oppGoal.y - bp.y; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    const rx = me.x - bp.x, ry = me.y - bp.y, along = rx * gx + ry * gy, lat = -rx * gy + ry * gx;
    const reach = cfg.ball.r + car.cls.len / 2;
    if (along < -8 && Math.abs(lat) < 26 + -along * 0.55) { target = { x: bp.x + gx * 60, y: bp.y + gy * 60 }; turbo = dMe > 70; }   // lined up: drive through it
    else if (along >= -8) { const side = lat >= 0 ? 1 : -1; target = { x: bp.x - gx * (reach + 50) - gy * side * (reach + 40), y: bp.y - gy * (reach + 50) + gx * side * (reach + 40) }; turbo = dMe > 260; } // wrong side: go round
    else { target = { x: bp.x - gx * (reach + 14), y: bp.y - gy * (reach + 14) }; turbo = dMe > 240; }
  } else {
    const k = 0.36; target = { x: ownGoal.x + (bp.x - ownGoal.x) * k, y: ownGoal.y + (bp.y - ownGoal.y) * k };
    target.x = dir > 0 ? Math.max(target.x, ownGoal.x + 120) : Math.min(target.x, ownGoal.x - 120); arrive = true;
  }
  target.x = clamp(target.x, R.left + 34, R.right - 34); target.y = clamp(target.y, R.top + 34, R.bottom - 34);
  for (let i = 0; i < 8 && !inField(A, target.x, target.y); i++) { target.x += (A.cx - target.x) * 0.2; target.y += (A.cy - target.y) * 0.2; } // odd-shaped arenas: stay on the floor

  // drive to the target point
  const v = B.getVelocity(car.body), speed = Math.hypot(v.x, v.y), dist = Math.hypot(target.x - me.x, target.y - me.y);
  const skill = game.skill ? game.skill[car.team] : 0.8;
  if (mem.rev > 0) { mem.rev--; return { throttle: -1, steer: mem.revSteer, turbo: false, brake: false }; }
  if (arrive && dist < 40) { const face = wrap(Math.atan2(bp.y - me.y, bp.x - me.x) - car.body.angle); mem.stuck = 0; return { throttle: 0, steer: clamp(face * 2, -1, 1), turbo: false, brake: false }; }
  const diff = wrap(Math.atan2(target.y - me.y, target.x - me.x) - car.body.angle), ad = Math.abs(diff);
  let throttle = ad < 1.25 ? 1 : ad > 2.35 && dist < 170 ? -1 : 0.5, steer = clamp(diff * 3, -1, 1);
  // steer round the furniture: poles, rocks, parked cars, pits, raised pylons, the boom's circle
  const fx = Math.cos(car.body.angle), fy = Math.sin(car.body.angle), look = 150 + speed * 9;
  const things = game.world.pylons.some((p) => p.up) ? [...A.blockers, ...game.world.pylons.filter((p) => p.up).map((p) => ({ x: p.x, y: p.y, r: cfg.hazards.pylons.r }))] : A.blockers;
  for (const o of things) {
    const ox = o.x - me.x, oy = o.y - me.y, f = ox * fx + oy * fy, r = -ox * fy + oy * fx, need = o.r + car.cls.wid / 2 + (o.pit ? 30 : 16);
    if (f < 0 || f > look + o.r || Math.abs(r) > need || Math.hypot(target.x - o.x, target.y - o.y) < o.r + 20) continue;
    if (o.soft && Math.abs(r) > need * 0.5) continue;
    steer = clamp(steer - (r >= 0 ? 1 : -1) * (o.pit ? 1.6 : 1.1), -1, 1); if (o.pit && f < o.r + 90) throttle = Math.min(throttle, 0.4); break;
  }
  if (throttle < 0) steer = -steer;
  if (speed < 0.35) { if (++mem.stuck > 45) { mem.stuck = 0; mem.rev = 26; mem.revSteer = mem.rand() < 0.5 ? -1 : 1; } } else mem.stuck = 0;
  const out = { throttle: throttle > 0 ? throttle * (0.72 + 0.28 * skill) : throttle, steer, turbo: turbo && ad < 0.5 && skill > 0.35, brake: ad > 1.0 && speed > 3.6, shunt: 0, use: false };
  tactics(game, car, mem, out, skill);
  return out;
}
