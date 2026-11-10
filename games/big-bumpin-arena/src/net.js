// Net: Client-side network coordinator for private multiplayer rooms.
// Host-authoritative model: server runs the sim, clients send inputs and reconcile/interpolate.
// State digest is a desync detector: on mismatch, resync from host snapshot.

import { HZ } from './config.js';

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 4; i++) res += chars[Math.floor(Math.random() * chars.length)];
  return res;
}

export function exportSnapshot(game) {
  const B = game.M.Body;
  const b = game.ball.body;
  const bv = B.getVelocity(b);
  const ballData = {
    x: b.position.x, y: b.position.y,
    vx: bv.x, vy: bv.y,
    angle: b.angle, av: B.getAngularVelocity(b),
    heat: game.ball.heat, curve: game.ball.curve,
    magnetBy: game.ball.magnetBy ? game.ball.magnetBy.index : null
  };
  const carsData = game.cars.map(c => {
    const v = B.getVelocity(c.body);
    return {
      index: c.index,
      x: c.body.position.x, y: c.body.position.y,
      vx: v.x, vy: v.y,
      angle: c.body.angle, av: B.getAngularVelocity(c.body),
      turbo: c.turbo, turboOn: c.turboOn,
      shuntCd: c.shuntCd, shuntT: c.shuntT,
      spinT: c.spinT, immune: c.immune, flatT: c.flatT,
      pitT: c.pitT, slip: c.slip, drift: c.drift,
      item: c.item, role: c.role
    };
  });
  return {
    ticks: game.ticks,
    clock: game.clock,
    state: game.state,
    timer: game.timer,
    score: [...game.score],
    overtime: game.overtime,
    winner: game.winner,
    digest: game.digest(),
    ball: ballData,
    cars: carsData
  };
}

export function applySnapshot(game, snap) {
  const B = game.M.Body;
  game.ticks = snap.ticks;
  game.clock = snap.clock;
  game.state = snap.state;
  game.timer = snap.timer;
  game.score = [...snap.score];
  game.overtime = snap.overtime;
  game.winner = snap.winner;

  // Ball
  const b = game.ball.body;
  B.setPosition(b, { x: snap.ball.x, y: snap.ball.y });
  B.setVelocity(b, { x: snap.ball.vx, y: snap.ball.vy });
  B.setAngle(b, snap.ball.angle);
  B.setAngularVelocity(b, snap.ball.av);
  game.ball.heat = snap.ball.heat;
  game.ball.curve = snap.ball.curve;
  game.ball.magnetBy = snap.ball.magnetBy !== null ? game.cars[snap.ball.magnetBy] : null;

  // Cars
  snap.cars.forEach(sc => {
    const c = game.cars[sc.index];
    B.setPosition(c.body, { x: sc.x, y: sc.y });
    B.setVelocity(c.body, { x: sc.vx, y: sc.vy });
    B.setAngle(c.body, sc.angle);
    B.setAngularVelocity(c.body, sc.av);
    c.turbo = sc.turbo;
    c.turboOn = sc.turboOn;
    c.shuntCd = sc.shuntCd;
    c.shuntT = sc.shuntT;
    c.spinT = sc.spinT;
    c.immune = sc.immune;
    c.flatT = sc.flatT;
    c.pitT = sc.pitT;
    c.slip = sc.slip;
    c.drift = sc.drift;
    c.item = sc.item;
    if (sc.role) c.role = sc.role;
  });
}

/** Interpolates remote cars with input-decay coasting */
export class RemoteInterpolator {
  constructor(carCount = 4) {
    this.targets = new Map(); // carIndex -> { x, y, angle, vx, vy, time }
  }
  updateTarget(carIndex, data) {
    this.targets.set(carIndex, { ...data, time: performance.now() });
  }
  apply(cars, localSeat, dt) {
    const now = performance.now();
    for (const c of cars) {
      if (c.index === localSeat) continue; // local car is predicted
      const t = this.targets.get(c.index);
      if (!t) continue;
      // Exponential smoothing towards target
      const alpha = Math.min(1, dt * 15);
      const pos = c.body.position;
      c.body.position.x += (t.x - pos.x) * alpha;
      c.body.position.y += (t.y - pos.y) * alpha;
      let dAngle = t.angle - c.body.angle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      c.body.angle += dAngle * alpha;
    }
  }
}
