// DUSTLINE — Off-Road Arcade. One sim, three looks (bake-off).
// Sim + input + HUD + state machine. Rendering lives in render.js.
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const renderer = new Renderer();
const audio = new DustAudio();

const RACE_LAPS = 4, TA_LAPS = 3;
const state = {
  mode: 'menu',            // menu | count | race | finish
  raceKind: 'race',        // race | ta
  look: 'A',
  time: 0, raceTime: 0, countT: 0, countStage: 4,
  trucks: [], particles: [], debris: [],
  pickups: [], stacks: [],
  paused: false, testAuto: false, frozen: false,
  overtakeEvents: 0, prevOrder: '',
  msg: '', msgT: 0, finalLapShown: false,
  results: null, err: null
};

// ---------------- input: keyboard + gptouch-standard touch ----------------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Digit1') setLook('A');
  if (e.code === 'Digit2') setLook('B');
  if (e.code === 'Digit3') setLook('C');
  if (e.code === 'Digit4') setLook('D');
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyR' && state.mode === 'finish') startRace(state.raceKind);
});
addEventListener('keyup', e => { keys[e.code] = false; });

// Floating joystick: anchors where the thumb lands on the left half.
const stick = { active: false, id: null, ax: 0, ay: 0, dx: 0, dy: 0 };
const btnState = { a: false, b: false, aPressed: false };
const stickBase = document.getElementById('stickBase'), stickKnob = document.getElementById('stickKnob');
function racingUI() { return (state.mode === 'race' || state.mode === 'count') && !state.paused; }
canvas.parentElement.addEventListener('pointerdown', e => {
  audio.init();
  if (!racingUI()) return;
  if (e.target.closest('button')) return;
  const w = innerWidth;
  if (e.clientX < w * 0.5 && !stick.active) {
    stick.active = true; stick.id = e.pointerId;
    stick.ax = e.clientX; stick.ay = e.clientY; stick.dx = 0; stick.dy = 0;
    stickBase.style.display = stickKnob.style.display = 'block';
    stickBase.style.left = (stick.ax - 55) + 'px'; stickBase.style.top = (stick.ay - 55) + 'px';
    stickKnob.style.left = (stick.ax - 26) + 'px'; stickKnob.style.top = (stick.ay - 26) + 'px';
  }
});
addEventListener('pointermove', e => {
  if (stick.active && e.pointerId === stick.id) {
    const R = 52;
    stick.dx = Math.max(-R, Math.min(R, e.clientX - stick.ax)) / R;
    stick.dy = Math.max(-R, Math.min(R, e.clientY - stick.ay)) / R;
    stickKnob.style.left = (stick.ax + stick.dx * R - 26) + 'px';
    stickKnob.style.top = (stick.ay + stick.dy * R - 26) + 'px';
  }
});
function stickEnd(e) {
  if (stick.active && e.pointerId === stick.id) {
    stick.active = false; stick.dx = stick.dy = 0;
    stickBase.style.display = stickKnob.style.display = 'none';
  }
}
addEventListener('pointerup', stickEnd);
addEventListener('pointercancel', stickEnd);
function bindBtn(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); if (key === 'a' && !btnState.a) btnState.aPressed = true; btnState[key] = true; el.classList.add('on'); });
  const off = e => { btnState[key] = false; el.classList.remove('on'); };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
bindBtn('btnA', 'a'); bindBtn('btnB', 'b');

function getInput() {
  let x = 0, y = 0;
  if (keys.ArrowLeft || keys.KeyA) x -= 1;
  if (keys.ArrowRight || keys.KeyD) x += 1;
  if (keys.ArrowUp || keys.KeyW) y += 1;
  if (keys.ArrowDown || keys.KeyS) y -= 1;
  if (stick.active) { x = stick.dx; y = -stick.dy; }
  const a = btnState.a || !!keys.Space;
  const aPressed = btnState.aPressed || (a && !getInput._pa);
  getInput._pa = a;
  btnState.aPressed = false;
  const b = btnState.b || !!keys.ShiftLeft || !!keys.ShiftRight;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), a, aPressed, b, bPressed: b && !getInput._pb, _set: (getInput._pb = b, true) };
}

// ---------------- race setup ----------------
function makeTruck(color, isPlayer, slot, skill, offset) {
  const S = TRACK.samples;
  const back = 7 + slot * 3.4;
  // find sample at progress -back (i.e. s = L - back)
  let idx = 0;
  const targetS = TRACK.length - back;
  for (let i = 0; i < S.length; i++) if (Math.abs(S[i].s - targetS) < Math.abs(S[idx].s - targetS)) idx = i;
  const p = S[idx];
  const nx = -Math.sin(p.ang), ny = Math.cos(p.ang);
  const lat = (slot % 2 === 0) ? 2.3 : -2.3;
  return {
    color, isPlayer, x: p.x + nx * lat, y: p.y + ny * lat, ang: p.ang,
    vx: 0, vy: 0, sampleIdx: idx, lastS: p.s, progress: -back,
    lap: 1, damage: 0, nitro: 3, nitroT: 0, wreckT: 0,
    finished: false, finishTime: 0, lapStart: 0, lastLap: 0, bestLap: 0, lapTimes: [],
    slip: 0, surf: 0, pos: slot + 1, topMul: 1, hitCool: 0,
    ai: { skill, offset, phase: Math.random() * 9, stuckT: 0, reverseT: 0, nitroCool: 3 + slot * 2 },
    stampAcc: [0, 0], emitAcc: 0
  };
}
function resetWorld() {
  state.pickups = TRACK.pickups.map(p => ({ ...p, active: true, respawnT: 0 }));
  state.stacks = TRACK.stacks.map(s => ({ ...s, broken: false, respawnT: 0 }));
  state.debris = []; state.particles = [];
  renderer.trackCtx.clearRect(0, 0, 848, 592);
  state.overtakeEvents = 0; state.prevOrder = ''; state.finalLapShown = false;
  state.msg = ''; state.msgT = 0; state.results = null;
}
function startRace(kind) {
  state.raceKind = kind;
  resetWorld();
  const racers = kind === 'race';
  state.trucks = racers
    ? [makeTruck('red', true, 2, 1, 0), makeTruck('blue', false, 0, 0.99, -1.2), makeTruck('green', false, 1, 0.965, 1.3), makeTruck('yellow', false, 3, 1.02, 0.2)]
    : [makeTruck('red', true, 0, 1, 0)];
  state.mode = 'count'; state.countT = 3.4; state.countStage = 4;
  state.raceTime = 0; state.paused = false;
  document.body.classList.add('racing');
  document.getElementById('menu').style.display = 'none';
  document.getElementById('finish').style.display = 'none';
  audio.init();
}
function totalLaps() { return state.raceKind === 'race' ? RACE_LAPS : TA_LAPS; }

// ---------------- AI ----------------
function aiInput(tr, dt) {
  const S = TRACK.samples, N = S.length, L = TRACK.length;
  const vf = tr.vx * Math.cos(tr.ang) + tr.vy * Math.sin(tr.ang);
  const speed = Math.hypot(tr.vx, tr.vy);
  const inp = { x: 0, y: 0, a: false, aPressed: false, b: false };
  // stuck recovery
  if (tr.ai.reverseT > 0) {
    tr.ai.reverseT -= dt;
    inp.y = -1; inp.x = tr.ai.revSteer || 0;
    return inp;
  }
  if (speed < 1.1 && state.mode === 'race') {
    tr.ai.stuckT += dt;
    if (tr.ai.stuckT > 2.2) {
      tr.ai.reverseT = 0.9; tr.ai.stuckT = 0;
      // steer nose toward the racing line while reversing
      const idx = tr.sampleIdx, p = S[idx];
      const want = Math.atan2(p.y - tr.y, p.x - tr.x);
      let d = want - tr.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      tr.ai.revSteer = Math.max(-1, Math.min(1, d * 1.4));
      if (tr.ai.stuckTotal > 6) { // teleport rescue
        tr.x = p.x; tr.y = p.y; tr.ang = p.ang; tr.vx = tr.vy = 0; tr.damage = Math.min(90, tr.damage + 10);
      }
      tr.ai.stuckTotal = (tr.ai.stuckTotal || 0) + 2.2;
    }
  } else { tr.ai.stuckT = 0; tr.ai.stuckTotal = 0; }
  // target: lookahead point on the line + lateral offset (+ avoidance)
  const look = 5.5 + Math.max(0, vf) * 0.55;
  let sFloat = ((tr.progress + look) % L + L) % L / L * N;
  const i0 = Math.floor(sFloat) % N, i1 = (i0 + 1) % N, fr = sFloat - Math.floor(sFloat);
  const tx0 = S[i0].x + (S[i1].x - S[i0].x) * fr, ty0 = S[i0].y + (S[i1].y - S[i0].y) * fr;
  const angL = S[i0].ang;
  let lat = tr.ai.offset + Math.sin(state.time * 0.23 + tr.ai.phase) * 0.7;
  // avoidance: truck ahead within 7 m of progress and close laterally -> step aside
  for (const o of state.trucks) {
    if (o === tr) continue;
    let dp = o.progress - tr.progress;
    if (dp > 0.5 && dp < 7.5) {
      const dx = o.x - tr.x, dy = o.y - tr.y;
      const latO = dx * -Math.sin(tr.ang) + dy * Math.cos(tr.ang);
      if (Math.abs(latO) < 2.0) lat = (latO >= 0 ? -1 : 1) * 2.7;
    }
  }
  const tx = tx0 + -Math.sin(angL) * lat, ty = ty0 + Math.cos(angL) * lat;
  const want = Math.atan2(ty - tr.y, tx - tr.x);
  let d = want - tr.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  inp.x = Math.max(-1, Math.min(1, d * 1.9));
  // corner speed from curvature at the target
  const curv = S[i0].curv;
  const surfTop = SURF_PROPS[TRACK.surfaceAt(tx0, ty0)].top;
  const vAllow = Math.min(surfTop, Math.sqrt(26 / Math.max(curv, 0.004))) * tr.ai.skill;
  if (vf < vAllow * 0.985) inp.y = 1;
  else if (vf > vAllow * 1.13) inp.y = -0.75;
  else inp.y = 0.12;
  // rubber band (race only, AI only)
  if (!tr.isPlayer && state.raceKind === 'race') {
    const pl = state.trucks[0];
    tr.topMul = Math.max(0.93, Math.min(1.07, 1 + (pl.progress - tr.progress) * 0.00045)) * tr.ai.skill;
  } else tr.topMul = tr.isPlayer ? 1 : tr.ai.skill;
  // nitro on straights
  tr.ai.nitroCool -= dt;
  if (tr.nitroCool <= 0 && tr.nitro > 0 && curv < 0.012 && vf > 8) { inp.aPressed = true; tr.ai.nitroCool = 6 + Math.random() * 5; }
  return inp;
}

// ---------------- physics ----------------
function stepTruck(tr, inp, dt) {
  const surf = TRACK.surfaceAt(tr.x, tr.y);
  tr.surf = surf;
  const P = SURF_PROPS[surf];
  let fx = Math.cos(tr.ang), fy = Math.sin(tr.ang);
  let vf = tr.vx * fx + tr.vy * fy, vl = tr.vx * -fy + tr.vy * fx;
  // steering (speed-sensitive, drift-friendly)
  const spdF = Math.max(-1, Math.min(1, vf / 7));
  tr.ang += inp.x * 2.35 * spdF * dt;
  fx = Math.cos(tr.ang); fy = Math.sin(tr.ang);
  vf = tr.vx * fx + tr.vy * fy; vl = tr.vx * -fy + tr.vy * fx;
  // nitro
  if (inp.aPressed && tr.nitro > 0 && tr.nitroT <= 0 && tr.wreckT <= 0) {
    tr.nitro--; tr.nitroT = 1.6;
    if (tr.isPlayer) audio.blip(180, 0.3, 'sawtooth', 0.1);
  }
  if (tr.nitroT > 0) tr.nitroT -= dt;
  const dmgMul = 1 - 0.22 * (tr.damage / 100);
  const top = P.top * dmgMul * tr.topMul * (tr.nitroT > 0 ? 1.38 : 1);
  if (tr.wreckT > 0) {
    tr.wreckT -= dt;
    vf *= Math.exp(-2.2 * dt);
    if (tr.wreckT <= 0) tr.damage = 55;
  } else if (inp.y > 0.03) {
    const acc = (tr.nitroT > 0 ? 25 : 15.5) * inp.y;
    if (vf < top) vf += acc * dt * Math.max(0.25, 1 - vf / top * 0.6);
  } else if (inp.y < -0.03 || inp.b) {
    const mag = Math.max(Math.abs(inp.y), inp.b ? 0.85 : 0);
    if (vf > 0.6) vf -= 21 * mag * dt;
    else vf = Math.max(-8.5, vf - 10 * mag * dt);
  }
  vf *= Math.exp(-P.drag * dt * (vf >= 0 ? 1 : 0.6));
  vl *= Math.exp(-P.gripLat * dt);
  if (surf === SURF.RIBS) vf *= Math.exp(-0.22 * dt);
  tr.vx = fx * vf + -fy * vl;
  tr.vy = fy * vf + fx * vl;
  tr.x += tr.vx * dt; tr.y += tr.vy * dt;
  tr.slip = Math.min(1, Math.abs(vl) * 0.13 + (Math.abs(inp.x) > 0.72 && Math.abs(vf) > 10 ? 0.22 : 0));
  // --- tape barrier clamp ---
  const S = TRACK.samples, N = S.length;
  let best = tr.sampleIdx, bd = Infinity;
  for (let k = -36; k <= 36; k++) {
    const i = (tr.sampleIdx + k + N) % N;
    const dx = tr.x - S[i].x, dy = tr.y - S[i].y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  const bp = S[best];
  const distC = Math.sqrt(bd);
  const maxD = bp.w / 2 - 1.05;
  if (distC > maxD && distC > 0.001) {
    const nx = (tr.x - bp.x) / distC, ny = (tr.y - bp.y) / distC;
    tr.x = bp.x + nx * maxD; tr.y = bp.y + ny * maxD;
    const vn = tr.vx * nx + tr.vy * ny;
    if (vn > 0) {
      tr.vx -= nx * vn * 1.35; tr.vy -= ny * vn * 1.35;
      if (vn > 4.2 && tr.hitCool <= 0) {
        tr.damage = Math.min(100, tr.damage + (vn - 4.2) * 1.6);
        tr.hitCool = 0.25;
        burst(tr.x, tr.y, surf, 7);
        if (tr.isPlayer) audio.thud(vn);
      }
    }
  }
  if (tr.hitCool > 0) tr.hitCool -= dt;
  // --- progress unwrap ---
  const sNew = S[best].s;
  let delta = sNew - tr.lastS;
  if (delta > TRACK.length / 2) delta -= TRACK.length;
  if (delta < -TRACK.length / 2) delta += TRACK.length;
  tr.progress += delta; tr.lastS = sNew; tr.sampleIdx = best;
  // lap bookkeeping
  const newLap = Math.floor(tr.progress / TRACK.length) + 1;
  if (newLap > tr.lap) {
    tr.lap = newLap;
    const lt = state.raceTime - tr.lapStart; tr.lapStart = state.raceTime;
    if (lt > 3) { tr.lastLap = lt; tr.lapTimes.push(lt); if (!tr.bestLap || lt < tr.bestLap) tr.bestLap = lt; }
    if (tr.isPlayer) {
      if (tr.lap === totalLaps()) { showMsg('FINAL LAP!'); state.finalLapShown = true; }
      else if (tr.lap > 1) showMsg('LAP ' + tr.lap);
    }
  }
  if (!tr.finished && tr.progress >= totalLaps() * TRACK.length) {
    tr.finished = true; tr.finishTime = state.raceTime;
  }
  emitVFX(tr, dt, vf, vl);
}

function collideTrucks(dt) {
  const T = state.trucks;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j];
    for (const [oa, ob] of [[-1.15, -1.15], [-1.15, 1.15], [1.15, -1.15], [1.15, 1.15]]) {
      const ax = a.x + Math.cos(a.ang) * oa, ay = a.y + Math.sin(a.ang) * oa;
      const bx = b.x + Math.cos(b.ang) * ob, by = b.y + Math.sin(b.ang) * ob;
      let dx = bx - ax, dy = by - ay;
      let d = Math.hypot(dx, dy);
      const minD = 2.1;
      if (d > 0.001 && d < minD) {
        dx /= d; dy /= d;
        const push = (minD - d) / 2;
        a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const rel = rvx * dx + rvy * dy;
        if (rel < 0) {
          const imp = -rel * 0.68;
          a.vx -= dx * imp; a.vy -= dy * imp; b.vx += dx * imp; b.vy += dy * imp;
          if (rel < -5) {
            a.damage = Math.min(100, a.damage + (-rel - 5) * 0.9);
            b.damage = Math.min(100, b.damage + (-rel - 5) * 0.9);
            burst((ax + bx) / 2, (ay + by) / 2, SURF.DIRT, 6);
            if (a.isPlayer || b.isPlayer) audio.thud(-rel);
          }
        }
      }
    }
  }
}

function burst(x, y, surf, n) {
  const col = [null, '#ecd28e', '#6b4423', '#a99c88', '#8d8578', '#cfeaff', '#c89b62'][surf] || '#c89b62';
  for (let i = 0; i < n; i++) {
    state.particles.push({
      type: 'dust', x, y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7, size: 0.5 + Math.random() * 0.5, col, over: false
    });
  }
}
function emitVFX(tr, dt, vf, vl) {
  const surf = tr.surf, speed = Math.abs(vf);
  tr.emitAcc += dt;
  const fx = Math.cos(tr.ang), fy = Math.sin(tr.ang), lx = -fy, ly = fx;
  const rearX = tr.x - fx * 1.9, rearY = tr.y - fy * 1.9;
  // tire tracks: stamp per rear wheel once per 0.22 m travelled
  tr.stampAcc[0] += speed * dt; tr.stampAcc[1] += speed * dt;
  if (surf !== SURF.WATER && speed > 1.2) {
    for (let wI = 0; wI < 2; wI++) {
      if (tr.stampAcc[wI] > 0.22) {
        tr.stampAcc[wI] = 0;
        const side = wI === 0 ? -0.85 : 0.85;
        const alpha = Math.min(0.5, 0.05 + tr.slip * 0.34 + (surf === SURF.SAND || surf === SURF.MUD ? 0.05 : 0));
        renderer.stampTracks(rearX + lx * side, rearY + ly * side, tr.ang, alpha, surf === SURF.MUD);
      }
    }
  }
  // particle emission (pooled by probability per step)
  const P = SURF_PROPS[surf];
  if (surf === SURF.WATER) {
    if (speed > 2.2 && Math.random() < dt * 42) {
      const side = Math.random() < 0.5 ? -1 : 1;
      state.particles.push({
        type: 'drop', x: tr.x + lx * side * 1.1, y: tr.y + ly * side * 1.1,
        vx: lx * side * (1.5 + Math.random() * 2.5) - fx * vf * 0.2, vy: ly * side * (1.5 + Math.random() * 2.5) - fy * vf * 0.2,
        life: 0.32 + Math.random() * 0.2, maxLife: 0.5, size: 0.3, col: '#cfeaff', over: true
      });
    }
    if (speed > 2.2 && Math.random() < dt * 7) {
      state.particles.push({ type: 'ring', x: tr.x, y: tr.y, vx: 0, vy: 0, life: 0.7, maxLife: 0.7, size: 1.1, col: '#bfe2ff', over: false });
    }
  } else if (speed > 3 && Math.random() < dt * (4 + tr.slip * 30) * P.dust + (speed > 8 ? dt * 3 : 0)) {
    const col = { 0: '#c89b62', 1: '#ecd28e', 2: '#6b4423', 3: '#a99c88', 4: '#8d8578', 6: '#c89b62' }[surf];
    state.particles.push({
      type: surf === SURF.MUD ? 'spray' : 'dust',
      x: rearX + lx * (Math.random() - 0.5) * 1.6, y: rearY + ly * (Math.random() - 0.5) * 1.6,
      vx: -fx * vf * 0.16 + (Math.random() - 0.5) * 1.6, vy: -fy * vf * 0.16 + (Math.random() - 0.5) * 1.6,
      life: 0.5 + Math.random() * 0.45, maxLife: 0.95, size: 0.45 + Math.random() * 0.5 + tr.slip * 0.4, col, over: false
    });
  }
  if (tr.nitroT > 0 && Math.random() < dt * 60) {
    const cols = ['#ffb03a', '#ff6a1e', '#ffe98a'];
    state.particles.push({
      type: 'flame', x: rearX + lx * (Math.random() - 0.5) * 0.5, y: rearY + ly * (Math.random() - 0.5) * 0.5,
      vx: -fx * 6, vy: -fy * 6, life: 0.16, maxLife: 0.16, size: 0.55, col: cols[(Math.random() * 3) | 0], over: true
    });
  }
  if (tr.wreckT > 0 && Math.random() < dt * 12) {
    state.particles.push({ type: 'dust', x: tr.x, y: tr.y - 0.5, vx: 0.3, vy: -0.6, life: 0.8, maxLife: 0.8, size: 0.7, col: '#3d3d3d', over: true });
  }
}

function stepSim(dt) {
  state.time += dt;
  if (state.msgT > 0) state.msgT -= dt;
  if (state.mode === 'count') {
    state.countT -= dt;
    const stage = Math.ceil(state.countT - 0.4);
    if (stage < state.countStage && stage >= 0) { state.countStage = stage; audio.countBeep(stage === 0); }
    if (state.countT <= 0) { state.mode = 'race'; showMsg('GO!'); }
    return;
  }
  if (state.mode !== 'race') return;
  state.raceTime += dt;
  // inputs
  for (const tr of state.trucks) {
    const inp = tr.isPlayer && !state.testAuto ? getInput() : aiInput(tr, dt);
    if (inp.aPressed && tr.isPlayer && state.testAuto) { /* AI handles its own */ }
    stepTruck(tr, inp, dt);
  }
  collideTrucks(dt);
  // pickups
  for (const p of state.pickups) {
    if (!p.active) { p.respawnT -= dt; if (p.respawnT <= 0) p.active = true; continue; }
    for (const tr of state.trucks) {
      const d = Math.hypot(tr.x - p.x, tr.y - p.y);
      if (d < 1.8) {
        p.active = false; p.respawnT = 20;
        if (p.type === 'nitro') { tr.nitro = Math.min(6, tr.nitro + 2); if (tr.isPlayer) { audio.pickup(); showMsg('NITRO +2'); } }
        else { tr.damage = Math.max(0, tr.damage - 60); if (tr.isPlayer) { audio.repair(); showMsg('REPAIRED'); } }
        break;
      }
    }
  }
  // stacks
  for (const s of state.stacks) {
    if (s.broken) { s.respawnT -= dt; if (s.respawnT <= 0) s.broken = false; continue; }
    for (const tr of state.trucks) {
      const d = Math.hypot(tr.x - s.x, tr.y - s.y);
      const spd = Math.hypot(tr.vx, tr.vy);
      if (d < 2.35) {
        if (spd > 3.2) {
          s.broken = true; s.respawnT = 25;
          tr.vx *= 0.84; tr.vy *= 0.84; tr.damage = Math.min(100, tr.damage + 2);
          for (let i = 0; i < 4; i++) {
            const a = Math.atan2(tr.y - s.y, tr.x - s.x) + (Math.random() - 0.5) * 1.6;
            state.debris.push({ x: s.x, y: s.y, vx: Math.cos(a) * (2 + Math.random() * 3.4), vy: Math.sin(a) * (2 + Math.random() * 3.4), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 9, life: 6 });
          }
          burst(s.x, s.y, SURF.DIRT, 8);
          if (tr.isPlayer) audio.thud(4);
        } else {
          const nx = (tr.x - s.x) / (d || 1), ny = (tr.y - s.y) / (d || 1);
          tr.x = s.x + nx * 2.35; tr.y = s.y + ny * 2.35;
        }
        break;
      }
    }
  }
  // debris + particles
  for (const d of state.debris) {
    d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
    d.vx *= Math.exp(-2.4 * dt); d.vy *= Math.exp(-2.4 * dt); d.vr *= Math.exp(-2.4 * dt); d.life -= dt;
  }
  state.debris = state.debris.filter(d => d.life > 0);
  for (const p of state.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.type === 'drop') { p.vx *= Math.exp(-1.5 * dt); p.vy *= Math.exp(-1.5 * dt); }
  }
  state.particles = state.particles.filter(p => p.life > 0);
  if (state.particles.length > 950) state.particles.splice(0, state.particles.length - 950);
  // positions + overtakes
  const order = [...state.trucks].sort((a, b) => b.progress - a.progress);
  order.forEach((tr, i) => { tr.pos = i + 1; });
  const key = order.map(t => t.color).join(',');
  if (state.prevOrder && key !== state.prevOrder) {
    const prev = state.prevOrder.split(',');
    let flips = 0;
    for (let i = 0; i < prev.length; i++) for (let j = i + 1; j < prev.length; j++) {
      const a = prev[i], b = prev[j];
      if (key.indexOf(a) > key.indexOf(b)) flips++;
    }
    state.overtakeEvents += flips;
  }
  state.prevOrder = key;
  // player audio
  const pl = state.trucks[0];
  const spd = Math.hypot(pl.vx, pl.vy);
  audio.update(Math.min(1, spd / 26), state.mode === 'race' ? 0.7 : 0, pl.slip, pl.surf === SURF.WATER, true);
  // finish
  if (pl.finished) {
    state.mode = 'finish';
    buildResults();
  }
}
function showMsg(m) { state.msg = m; state.msgT = 1.6; }
function buildResults() {
  const sorted = [...state.trucks].sort((a, b) => b.progress - a.progress);
  state.results = sorted.map(tr => ({
    color: tr.color, isPlayer: tr.isPlayer,
    time: tr.finished ? tr.finishTime : null,
    bestLap: tr.bestLap || 0, damage: Math.round(tr.damage)
  }));
  if (state.raceKind === 'ta') {
    const pl = state.trucks[0];
    const prev = parseFloat(localStorage.getItem('dustline_bestlap') || '0');
    if (pl.bestLap && (!prev || pl.bestLap < prev)) localStorage.setItem('dustline_bestlap', String(pl.bestLap));
  }
  const fin = document.getElementById('finish');
  const rows = state.results.map((r, i) => {
    const name = r.isPlayer ? 'YOU' : r.color.toUpperCase();
    const tm = r.time ? fmtTime(r.time) : 'DNF';
    const best = r.bestLap ? fmtTime(r.bestLap) : '—';
    return `<div class="frow ${r.isPlayer ? 'me' : ''}"><span>${i + 1}. ${name}</span><span>${tm}</span><span class="dim">best ${best}</span></div>`;
  }).join('');
  document.getElementById('finishTitle').textContent =
    state.raceKind === 'ta' ? 'TIME ATTACK — DONE' : (state.results[0].isPlayer ? 'YOU WIN!' : 'P' + (state.results.findIndex(r => r.isPlayer) + 1) + ' — RACE OVER');
  document.getElementById('finishRows').innerHTML = rows;
  fin.style.display = 'flex';
  document.body.classList.remove('racing');
}

// ---------------- HUD ----------------
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
function drawHUD() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const pl = state.trucks[0];
  const look = state.look;
  const fs = Math.max(13, Math.min(19, ch * 0.026));
  ctx.textBaseline = 'top';
  if (state.mode === 'race' || state.mode === 'count' || state.mode === 'finish') {
    if (pl) {
      const colMain = look === 'B' ? '#ffe9bd' : '#ff6a33';
      const colSub = look === 'B' ? '#ffd9a0' : '#ffb03a';
      ctx.font = `700 ${fs}px ${look === 'B' ? '"Trebuchet MS",sans-serif' : '"Courier New",monospace'}`;
      const line = (txt, y, col) => {
        ctx.fillStyle = 'rgba(10,6,3,0.85)'; ctx.fillText(txt, 13, y + 2);
        ctx.fillStyle = col; ctx.fillText(txt, 11, y);
      };
      if (state.raceKind === 'race') line(`P1 ${pl.pos}/${state.trucks.length}`, 10, colMain);
      else line('TIME ATTACK', 10, colMain);
      line(`LAP ${Math.min(pl.lap, totalLaps())}/${totalLaps()}`, 10 + fs * 1.25, colMain);
      // TRUCK damage bar
      const bw = fs * 5.2, bh = fs * 0.52, bx = 11 + fs * 3.4, by = 10 + fs * 2.5;
      ctx.fillStyle = 'rgba(10,6,3,0.85)'; ctx.fillText('TRUCK', 13, by + 2);
      ctx.fillStyle = colMain; ctx.fillText('TRUCK', 11, by);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
      const hp = 1 - pl.damage / 100;
      ctx.fillStyle = hp > 0.5 ? '#37d93a' : hp > 0.25 ? '#ffb03a' : '#e83a26';
      ctx.fillRect(bx, by, bw * hp, bh);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeRect(bx, by, bw, bh);
      line(`NITRO ${pl.nitro}`, by + bh + fs * 0.35, colSub);
      if (state.raceKind === 'ta') {
        const cur = state.raceTime - pl.lapStart;
        line(`LAP TIME ${fmtTime(cur)}`, by + bh + fs * 1.6, colSub);
        const best = parseFloat(localStorage.getItem('dustline_bestlap') || '0');
        if (best) line(`BEST ${fmtTime(best)}`, by + bh + fs * 2.85, colSub);
      }
    }
    // race timer top-centre
    ctx.font = `700 ${fs * 1.05}px ${look === 'B' ? '"Trebuchet MS",sans-serif' : '"Courier New",monospace'}`;
    const tt = fmtTime(state.raceTime);
    const tw = ctx.measureText(tt).width;
    ctx.fillStyle = 'rgba(10,6,3,0.85)'; ctx.fillText(tt, (cw - tw) / 2 + 2, 12);
    ctx.fillStyle = '#fff'; ctx.fillText(tt, (cw - tw) / 2, 10);
    // look tag bottom-left
    ctx.font = `700 ${fs * 0.66}px "Courier New",monospace`;
    const lt = `LOOK ${look} — ${LOOK_CONF[look].name}  [1/2/3]`;
    ctx.fillStyle = 'rgba(10,6,3,0.7)'; ctx.fillText(lt, 12, ch - fs * 1.05);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(lt, 11, ch - fs * 1.1);
  }
  // centre messages
  ctx.textAlign = 'center';
  if (state.mode === 'count') {
    const n = Math.ceil(state.countT - 0.4);
    ctx.font = `900 ${ch * 0.16}px "Courier New",monospace`;
    ctx.fillStyle = 'rgba(10,6,3,0.8)'; ctx.fillText(n > 0 ? n : 'GO!', cw / 2 + 3, ch * 0.36 + 3);
    ctx.fillStyle = n > 0 ? '#ffb03a' : '#37d93a'; ctx.fillText(n > 0 ? n : 'GO!', cw / 2, ch * 0.36);
  } else if (state.msgT > 0 && state.msg) {
    ctx.font = `900 ${ch * 0.055}px ${look === 'B' ? '"Trebuchet MS",sans-serif' : '"Courier New",monospace'}`;
    ctx.globalAlpha = Math.min(1, state.msgT);
    ctx.fillStyle = 'rgba(10,6,3,0.85)'; ctx.fillText(state.msg, cw / 2 + 2, ch * 0.2 + 2);
    ctx.fillStyle = '#ffd23e'; ctx.fillText(state.msg, cw / 2, ch * 0.2);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

// ---------------- main loop / view ----------------
let view = { x: 0, y: 0, w: 0, h: 0 };
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  const scale = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h);
  view = { w: WORLD.w * scale, h: WORLD.h * scale, x: (canvas.width - WORLD.w * scale) / 2, y: (canvas.height - WORLD.h * scale) / 2 };
}
addEventListener('resize', resize);
let lastT = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (state.frozen) return;
  if (!lastT) lastT = ts;
  let dt = (ts - lastT) / 1000; lastT = ts;
  if (dt > 0.25) dt = 0.25;
  if (!state.paused) {
    acc += dt;
    const step = 1 / 60;
    let n = 0;
    while (acc >= step && n < 8) { stepSim(step); acc -= step; n++; }
    if (n === 8) acc = 0;
  }
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderer.render(state, state.look, view, ctx);
  } catch (err) { showError(err); return; }
  drawHUD();
}
function showError(err) {
  const el = document.getElementById('err');
  el.style.display = 'block';
  el.textContent = 'RENDER ERROR (' + state.look + '): ' + (err && err.message);
  console.error(err);
}

// ---------------- look switching / pause / menu wiring ----------------
function setLook(l) {
  if (!LOOK_CONF[l]) return;
  state.look = l;
  document.body.className = document.body.className.replace(/look-\w/g, '').trim();
  document.body.classList.add('look-' + l.toLowerCase());
  if (state.mode === 'race' || state.mode === 'count') document.body.classList.add('racing');
  document.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('sel', b.dataset.look === l));
  const desc = {
    A: 'Amiga-500 palette pixel art — their look, faithfully crunched.',
    B: 'Painted storybook style — Palm City strokes, warm golden light.',
    C: 'Voxel-shaded truck sprites at 16 angles on a pixelfx-crunched world.',
    D: 'CANDIDATE: Gemini hand-painted ground — the repaint as the world itself.'
  }[l];
  const ld = document.getElementById('lookDesc');
  if (ld) ld.textContent = desc;
  try { renderer.ensure(l); } catch (err) { showError(err); }
}
function togglePause() {
  if (state.mode !== 'race' && state.mode !== 'count') return;
  state.paused = !state.paused;
  document.getElementById('pauseBtn').textContent = state.paused ? '▶' : '❚❚';
  if (state.paused) showMsg('PAUSED');
}
document.querySelectorAll('[data-look]').forEach(b => b.addEventListener('click', () => { audio.init(); setLook(b.dataset.look); }));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  state.raceKind = b.dataset.mode;
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('sel', x === b));
}));
document.getElementById('playBtn').addEventListener('click', () => { audio.init(); startRace(state.raceKind); });
document.getElementById('againBtn').addEventListener('click', () => startRace(state.raceKind));
document.getElementById('menuBtn').addEventListener('click', () => {
  state.mode = 'menu';
  document.getElementById('finish').style.display = 'none';
  document.getElementById('menu').style.display = 'flex';
  document.body.classList.remove('racing');
  resetWorld();
  state.trucks = [makeTruck('red', true, 2, 1, 0), makeTruck('blue', false, 0, 0.99, -1.2), makeTruck('green', false, 1, 0.965, 1.3), makeTruck('yellow', false, 3, 1.02, 0.2)];
});
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.addEventListener('pointerdown', () => audio.init(), { once: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) audio.resume(); });

// attract state: trucks parked on the grid behind the menu
resetWorld();
state.trucks = [makeTruck('red', true, 2, 1, 0), makeTruck('blue', false, 0, 0.99, -1.2), makeTruck('green', false, 1, 0.965, 1.3), makeTruck('yellow', false, 3, 1.02, 0.2)];
setLook('D'); // candidate build: the Gemini repaint is the look being judged
resize();
requestAnimationFrame(frame);

// ---------------- test hooks ----------------
window.__dust = {
  state, renderer, TRACK,
  startRace, setLook,
  setKind(k) { state.raceKind = k; },
  auto(on) { state.testAuto = !!on; },
  freeze(on) { state.frozen = !!on; },
  renderOnce() { ctx.setTransform(1, 0, 0, 1, 0, 0); renderer.render(state, state.look, view, ctx); drawHUD(); },
  skipCount() { if (state.mode === 'count') { state.countT = 0; state.mode = 'race'; } },
  step(n) { for (let i = 0; i < n; i++) stepSim(1 / 60); },
  teleport(i, x, y, ang) {
    const tr = state.trucks[i]; tr.x = x; tr.y = y; if (ang !== undefined) tr.ang = ang; tr.vx = tr.vy = 0;
    // re-sync to the nearest centreline sample so the tape clamp doesn't yank it back
    const S = TRACK.samples; let best = 0, bd = Infinity;
    for (let k = 0; k < S.length; k++) { const dx = x - S[k].x, dy = y - S[k].y, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = k; } }
    tr.sampleIdx = best; tr.lastS = S[best].s;
  },
  setSpeed(i, vx, vy) { const tr = state.trucks[i]; tr.vx = vx; tr.vy = vy; },
  trackDark() {
    const g = renderer.trackCtx.getImageData(0, 0, 848, 592).data;
    let n = 0; for (let i = 3; i < g.length; i += 16) if (g[i] > 30) n++;
    return n;
  },
  order() { return [...state.trucks].sort((a, b) => b.progress - a.progress).map(t => t.color); }
};
