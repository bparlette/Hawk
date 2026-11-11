// Scene 8: cucco-swarm
// The plaza, midday. Juniper clips a cucco with a careless elbow; the flock
// swarms and chases him a full circuit of the plaza — through the market stalls,
// past the fountain, crowd scattering, feathers everywhere — until he vaults
// the fountain rim and the flock breaks off, victorious, as he sits dripping on the far side.
// Bookmark: fountain-side three-quarter, plaza and stalls behind.
// Duration ~30 s (900 ticks). Events: clip, swarm, circuit, vault, break-off.
import { kf, ramp, person, thing, JUNIPER, townLook } from './stage.js';

const M = 0.01;
const CUCCO_COUNT = 32;
const C = {
  hold: 50,
  clip: 90,
  swarm: 130,
  circuit: 200,
  vault: 700,
  breakOff: 760,
  sit: 810,
  end: 900,
};

const cam = (o, x, y, z, tx, ty, tz) => {
  const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
  return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d };
};

export const cuccoSwarm = {
  id: 'cucco-swarm',
  title: 'Cucco swarm: Juniper clips a cucco; an army of them chases him around the plaza fountain',
  duration: C.end,
  light: 'noon',
  bookmark: (g) => {
    const f = g.city.fountain;
    const o = [f.x * M, 0, f.z * M];
    return cam(o, 8.5, 3.2, 8.5, 0, 1.2, 0);
  },
  set(g) {
    const f = g.city.fountain;
    const o = [f.x * M, 0, f.z * M];
    return {
      origin: o,
      props: [
        thing('fountain', 'fountain', 0, 0, 0),
        thing('stall1', 'stall', -6.5, 0, -4.5, 0.4),
        thing('stall2', 'stall', 6.5, 0, -4.5, -0.4),
      ],
      actors: [
        person('juniper', { ...JUNIPER }, -3.5, 0, -2.5, 0),
        person('town1', townLook(1), -5.0, 0, -1.0, 1.2),
        person('town2', townLook(2), 5.0, 0, -1.0, -1.2),
        person('town3', townLook(3), -1.5, 0, -5.5, 0.2),
        thing('splash', 'splash', 0, 0.4, 0, 0, { p: -1 }),
        ...Array.from({ length: CUCCO_COUNT }, (_, i) => thing('cucco' + i, 'cucco', 0, 0, 0)),
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper;
    j.pose = {};
    j.vis = true;

    // Juniper trajectory:
    // 0..clip: strolling casually near stall 1
    // clip..swarm: stumbles, turns to look in horror
    // circuit (200..700): runs full circuit around fountain (r = 4.2m)
    // vault (700..760): leaps over fountain rim
    // breakOff..end: sits dripping on far fountain ledge
    if (t < C.clip) {
      j.x = kf(t, [[0, -4.5], [C.clip, -2.8]]);
      j.z = kf(t, [[0, -3.2], [C.clip, -2.2]]);
      j.y = 0;
      j.yaw = 0.9;
      j.pose.walk = t * 0.25;
      j.pose.armL = [0.2, 0.2];
      j.pose.armR = [0.2, -0.2];
    } else if (t < C.swarm) {
      // Stumble and comic freeze
      j.x = -2.7;
      j.z = -2.1;
      j.y = 0;
      j.yaw = -2.2;
      j.pose.lean = 0.25;
      j.pose.armL = [1.8, 0.5];
      j.pose.armR = [1.8, -0.5];
    } else if (t < C.vault) {
      // Running circuit around fountain (radius 4.2m, theta from 3.8 to 3.8 + 2*PI)
      const prog = ramp(t, C.swarm, C.vault);
      const angle = 3.8 + prog * Math.PI * 2.2;
      const r = 4.2;
      j.x = Math.cos(angle) * r;
      j.z = Math.sin(angle) * r;
      j.y = 0;
      j.yaw = angle + Math.PI / 2;
      j.pose.walk = t * 0.75;
      j.pose.lean = -0.3;
      j.pose.armL = [2.2, 0.8];
      j.pose.armR = [2.2, -0.8];
    } else if (t < C.breakOff) {
      // Vaulting fountain rim into water
      const vProg = ramp(t, C.vault, C.breakOff);
      j.x = kf(t, [[C.vault, 2.8], [C.breakOff, 1.2]]);
      j.z = kf(t, [[C.vault, 2.8], [C.breakOff, 1.2]]);
      j.y = Math.sin(vProg * Math.PI) * 1.5;
      j.yaw = 2.4;
      j.pose.lean = 0.4;
      j.pose.armL = [2.5, 0.6];
      j.pose.armR = [2.5, -0.6];
      A.splash.p = vProg;
      A.splash.x = j.x;
      A.splash.z = j.z;
    } else {
      // Sits dripping on the far rim
      j.x = 1.0;
      j.z = 1.0;
      j.y = 0.45;
      j.yaw = 0.8;
      j.pose.crouch = 0.65;
      j.pose.lean = 0.2;
      j.pose.armL = [0.4, 0.3];
      j.pose.armR = [0.4, -0.3];
      j.pose.headYaw = 0.1;
    }

    // Townsfolk scatter during circuit
    for (const tid of ['town1', 'town2', 'town3']) {
      const p = A[tid];
      if (t > C.swarm && t < C.breakOff) {
        p.pose = { armL: [2.0, 0.4], armR: [2.0, -0.4], lean: 0.25, walk: t * 0.5 };
      } else {
        p.pose = {};
      }
    }

    // The Cucco Army (32 birds)
    for (let i = 0; i < CUCCO_COUNT; i++) {
      const c = A['cucco' + i];
      c.vis = true;
      if (t < C.clip) {
        // Idling calmly in plaza
        const cx = -2.5 + ((i % 6) - 2.5) * 0.8;
        const cz = -2.0 + (Math.floor(i / 6) - 2.5) * 0.8;
        c.x = cx;
        c.z = cz;
        c.y = 0;
        c.yaw = ((i * 1.7) % 6.28);
        c.flap = Math.sin(t * 0.1 + i) * 0.1;
      } else if (t < C.swarm) {
        // Sudden alert: heads cocked, wings bristling
        const cx = -2.5 + ((i % 6) - 2.5) * 0.7;
        const cz = -2.0 + (Math.floor(i / 6) - 2.5) * 0.7;
        c.x = cx;
        c.z = cz;
        c.y = (t > C.clip + 20) ? Math.abs(Math.sin((t - C.clip) * 0.4 + i)) * 0.4 : 0;
        c.yaw = Math.atan2(j.x - c.x, j.z - c.z);
        c.flap = (t > C.clip + 20) ? t * 0.8 + i : 0;
      } else if (t < C.vault) {
        // Swarm pursuit: trailing behind Juniper along the circuit
        const trailDist = 0.08 + (i % 8) * 0.05 + Math.floor(i / 8) * 0.06;
        const prog = Math.max(0, ramp(t, C.swarm, C.vault) - trailDist);
        const angle = 3.8 + prog * Math.PI * 2.2 + ((i % 4) - 1.5) * 0.15;
        const r = 4.2 + (Math.floor(i / 4) % 3 - 1) * 0.5;
        c.x = Math.cos(angle) * r;
        c.z = Math.sin(angle) * r;
        c.y = Math.abs(Math.sin(t * 0.6 + i * 1.3)) * 0.6;
        c.yaw = angle + Math.PI / 2;
        c.flap = t * 1.2 + i;
      } else if (t < C.breakOff) {
        // Sudden brake & hover at fountain rim
        const hoverProg = ramp(t, C.vault, C.breakOff);
        const angle = 3.8 + 2.2 * Math.PI + (i / CUCCO_COUNT) * Math.PI * 1.2;
        c.x = Math.cos(angle) * 3.6 + Math.sin(t * 0.2 + i) * 0.3;
        c.z = Math.sin(angle) * 3.6 + Math.cos(t * 0.2 + i) * 0.3;
        c.y = 1.0 + Math.sin(t * 0.4 + i) * 0.5;
        c.yaw = Math.atan2(j.x - c.x, j.z - c.z);
        c.flap = t * 0.9 + i;
      } else {
        // Victorious strutting and fluttering on the outer rim
        const angle = (i / CUCCO_COUNT) * Math.PI * 2;
        c.x = Math.cos(angle) * 3.5;
        c.z = Math.sin(angle) * 3.5;
        c.y = 0.4;
        c.yaw = angle + Math.PI;
        c.flap = Math.sin(t * 0.2 + i) * 0.2;
      }
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: C.clip, name: 'clip' },
    { at: C.swarm, name: 'swarm' },
    { at: C.circuit, name: 'circuit' },
    { at: C.vault, name: 'vault' },
    { at: C.breakOff, name: 'break-off' },
    { at: C.sit, name: 'sit' },
    { at: C.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'chirp', vol: 0.2 },
    { at: C.clip, cue: 'squawk', vol: 0.9 },
    { at: C.clip + 15, cue: 'cluck', vol: 0.8 },
    { at: C.swarm, cue: 'sting', vol: 1.2 },
    { at: C.circuit, cue: 'squeal', vol: 0.8 },
    { at: C.circuit + 70, cue: 'flutter', vol: 0.9 },
    { at: C.circuit + 140, cue: 'squawk', vol: 0.7 },
    { at: C.circuit + 220, cue: 'flutter', vol: 0.9 },
    { at: C.circuit + 300, cue: 'squawk', vol: 0.8 },
    { at: C.circuit + 380, cue: 'flutter', vol: 0.9 },
    { at: C.vault, cue: 'boing', vol: 1.1 },
    { at: C.vault + 18, cue: 'splash', vol: 1.6 },
    { at: C.breakOff, cue: 'cheer', vol: 1.0 },
    { at: C.sit, cue: 'drip', vol: 0.6 },
    { at: C.sit + 40, cue: 'cluck', vol: 0.8 },
    { at: C.end - 1, cue: 'cluck', vol: 0.4 },
  ],
  bed: { kind: 'dance', vol: 0.05, loops: 'hum', swell: (t) => (t > C.swarm && t < C.breakOff ? 1.4 : 0.6) },
};
