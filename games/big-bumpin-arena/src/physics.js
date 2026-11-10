// Physics factories (car-league's physics/ layer): arena data in, Matter bodies out. No DOM, no rendering.
// `M` is the Matter namespace, passed in so the same code runs in the browser (script tag) and in node (require).
export const CAT = { WALL: 1, BALL: 2, CAR: 4, LIP: 8 };

/**
 * Named wall pieces for an arena (car-league createArenaWallConfigs pattern, with ice-bumpers' idea that a goal
 * mouth is a recess in the wall line). The arena's closed polygon becomes one slab per edge, laid outside the
 * line; then posts at the goal mouths, a car-only lip on each goal line, and the arena's furniture.
 * Entries: { name, kind, x, y, w, h, angle } or round { name, kind, x, y, r }. The name lives on the body itself
 * (car-league's index-zipped name map is order-fragile).
 */
export function createArenaWallConfigs(cfg, arena) {
  const t = cfg.rink.wall, out = [], p = arena.poly, n = p.length;
  let area = 0; for (let i = 0; i < n; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n]; area += x0 * y1 - x1 * y0; }
  const sign = area > 0 ? 1 : -1; // which side is outside
  for (let i = 0; i < n; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy); if (len < 0.5) continue;
    const nx = (dy / len) * sign, ny = (-dx / len) * sign; // outward normal
    out.push({ name: `wall${i}`, kind: 'wall', x: (x0 + x1) / 2 + nx * t / 2, y: (y0 + y1) / 2 + ny * t / 2, w: len + t * 0.9, h: t, angle: Math.atan2(dy, dx) });
  }
  for (const g of arena.goals) {
    const side = g.dir < 0 ? 'left' : 'right';
    out.push({ name: `${side}PostTop`, kind: 'post', x: g.x, y: g.y - g.half, r: cfg.rink.postR }, { name: `${side}PostBottom`, kind: 'post', x: g.x, y: g.y + g.half, r: cfg.rink.postR });
    out.push({ name: `${side}Lip`, kind: 'lip', x: g.x + g.dir * 8, y: g.y, w: 16, h: g.half * 2, angle: 0 }); // stops cars at the goal line; the ball passes through
  }
  arena.obstacles.forEach((o, i) => out.push({ name: `${o.kind}${i}`, kind: 'obstacle', what: o.kind, x: o.x, y: o.y, r: o.r, w: o.w, h: o.h, angle: o.angle || 0 }));
  return out;
}

/** Net trigger zones: the ball is in when its centre is inside one. */
export function goalZones(cfg, arena) {
  const m = cfg.ball.r * 0.55, d = arena.netDepth + 10;
  return arena.goals.map((g) => ({ name: g.dir < 0 ? 'left' : 'right', scoringTeam: 1 - g.team, x0: g.dir < 0 ? g.x - d : g.x + m, x1: g.dir < 0 ? g.x - m : g.x + d, y0: g.y - g.half, y1: g.y + g.half }));
}

export function createArena(M, cfg, arena) {
  return createArenaWallConfigs(cfg, arena).map((w) => {
    const lip = w.kind === 'lip', bouncy = w.what === 'tires' || w.what === 'carousel' || w.what === 'bollard';
    const opts = { isStatic: true, label: w.name, restitution: bouncy ? 0.95 : cfg.restitution.wall, friction: 0, angle: w.angle || 0,
      collisionFilter: { category: lip ? CAT.LIP : CAT.WALL, mask: lip ? CAT.CAR : CAT.BALL | CAT.CAR } };
    const body = w.r ? M.Bodies.circle(w.x, w.y, w.r, opts) : M.Bodies.rectangle(w.x, w.y, w.w, w.h, { ...opts, chamfer: w.kind === 'obstacle' ? { radius: 8 } : undefined });
    body.plugin.bba = { type: 'wall', name: w.name, kind: w.kind, what: w.what, cfg: w };
    return body;
  });
}

export function createBall(M, cfg, arena) {
  const b = cfg.ball;
  const body = M.Bodies.circle(arena.cx, arena.cy, b.r, { label: 'ball', restitution: cfg.restitution.ball, friction: 0, frictionStatic: 0, frictionAir: b.frictionAir,
    collisionFilter: { category: CAT.BALL, mask: CAT.WALL | CAT.CAR } });
  M.Body.setMass(body, b.mass);
  body.plugin.bba = { type: 'ball' };
  return body;
}

/** One rigid body per car. In a top-down plane the only rotation that exists is yaw, so a car can spin but
 *  can never flip or leave the ground (kfarr's "lock rotation to the yaw axis at the body level" rule). */
export function createCar(M, cfg, cls, x, y, angle) {
  const c = cfg.classes[cls];
  const body = M.Bodies.rectangle(x, y, c.len, c.wid, { label: 'car', chamfer: { radius: Math.min(c.wid * 0.38, 20) }, angle, restitution: cfg.restitution.car, friction: 0, frictionStatic: 0, frictionAir: 0,
    collisionFilter: { category: CAT.CAR, mask: CAT.WALL | CAT.BALL | CAT.CAR | CAT.LIP } });
  M.Body.setMass(body, c.mass);
  M.Body.setInertia(body, body.inertia * c.inertia);
  body.plugin.bba = { type: 'car' };
  return body;
}
