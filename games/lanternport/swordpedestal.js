// sword-pedestal: plaza, golden hour — Juniper draws the sword from the stone pedestal.
// Built on stage.js / stageview.js with scene-local stage kinds (no edits to view.js/fx.js).
import * as T from './lib/three.module.min.js';
import { kf, ramp, between, person, thing, walk, hash, townLook, JUNIPER, FEN } from './stage.js';
import { registerStageKind } from './stageview.js';

const M = 0.01;
const cam = (o, x, y, z, tx, ty, tz) => {
  const dx = tx - x, dy = ty - y, dz = tz - z, d = Math.hypot(dx, dy, dz);
  return { pivot: [o[0] + tx, o[1] + ty, o[2] + tz], yaw: Math.atan2(dx, dz), pitch: Math.asin(-dy / d), dist: d };
};

// --------------------------------------------------------------------------- Scene-local Stage Kinds
registerStageKind('pedestal', (_T, kit) => {
  const g = new T.Group();
  const stone = kit.toon(0x8e929c, { rim: 0.55 });
  const darkStone = kit.toon(0x5d626e, { rim: 0.45 });
  const runeM = new T.MeshBasicMaterial({ color: 0xffe484, transparent: true, opacity: 0.45 });

  // Two stepped octagonal/cylindrical stone tiers + altar block
  kit.part(g, new T.CylinderGeometry(1.35, 1.5, 0.24, 8), darkStone, 0, 0.12, 0);
  kit.part(g, new T.CylinderGeometry(0.95, 1.12, 0.28, 8), stone, 0, 0.38, 0);
  kit.part(g, new T.BoxGeometry(0.92, 0.56, 0.92), stone, 0, 0.8, 0);
  const runeRing = new T.Mesh(new T.RingGeometry(0.56, 0.68, 24), runeM);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 1.09;
  g.add(runeRing);

  // Planted sword (point-down into the altar top)
  const sword = new T.Group();
  const bladeM = kit.toon(0xe6eef8, { rim: 1.0 });
  const hiltM = kit.toon(0x2d4b8e, { rim: 0.7 });
  const goldM = kit.toon(0xf2c249, { rim: 0.9 });
  kit.part(sword, new T.BoxGeometry(0.09, 1.18, 0.028), bladeM, 0, 0.59, 0);
  kit.part(sword, new T.BoxGeometry(0.46, 0.06, 0.07), goldM, 0, 1.18, 0);
  kit.part(sword, new T.CylinderGeometry(0.035, 0.04, 0.28, 8), hiltM, 0, 1.35, 0);
  kit.part(sword, new T.OctahedronGeometry(0.065, 0), goldM, 0, 1.52, 0);
  sword.position.set(0, 0.62, 0);
  g.add(sword);

  g.userData.pose = (a) => {
    sword.visible = !a.drawn;
    sword.position.y = 0.62 + (a.pull || 0) * 0.62;
    runeM.opacity = 0.3 + (a.glow || 0) * 0.65;
  };
  return g;
});

registerStageKind('heldSword', (_T, kit) => {
  const g = new T.Group();
  const bladeM = kit.toon(0xf2f7ff, { rim: 1.2 });
  const hiltM = kit.toon(0x2d4b8e, { rim: 0.7 });
  const goldM = kit.toon(0xf4c84b, { rim: 1.0 });
  kit.part(g, new T.BoxGeometry(0.095, 1.24, 0.03), bladeM, 0, 0.85, 0);
  kit.part(g, new T.BoxGeometry(0.48, 0.06, 0.07), goldM, 0, 0.23, 0);
  kit.part(g, new T.CylinderGeometry(0.035, 0.04, 0.26, 8), hiltM, 0, 0.08, 0);
  kit.part(g, new T.OctahedronGeometry(0.065, 0), goldM, 0, -0.07, 0);
  return g;
});

registerStageKind('lightShaft', () => {
  const g = new T.Group();
  const outerM = new T.MeshBasicMaterial({
    color: 0xffe69a, transparent: true, opacity: 0.14, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
  });
  const coreM = new T.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
  });
  const outer = new T.Mesh(new T.CylinderGeometry(1.8, 0.75, 16, 20, 1, true), outerM);
  outer.position.y = 8;
  const core = new T.Mesh(new T.CylinderGeometry(0.8, 0.28, 16, 16, 1, true), coreM);
  core.position.y = 8;
  g.add(outer, core);
  g.userData.pose = (a) => {
    const p = a.power || 0;
    const s = 1 + p * 1.45;
    outer.scale.set(s, 1, s);
    core.scale.set(1 + p * 1.9, 1, 1 + p * 1.9);
    outerM.opacity = 0.13 + p * 0.34;
    coreM.opacity = 0.16 + p * 0.48;
  };
  return g;
});

registerStageKind('shockRing', () => {
  const mat = new T.MeshBasicMaterial({
    color: 0xfff0a8, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
  });
  const mesh = new T.Mesh(new T.RingGeometry(0.85, 1.25, 36), mat);
  mesh.rotation.x = -Math.PI / 2;
  const g = new T.Group();
  g.add(mesh);
  g.userData.pose = (a) => {
    const p = a.p ?? -1;
    g.visible = p >= 0 && p <= 1;
    if (!g.visible) return;
    const sc = 0.8 + p * 12.5;
    mesh.scale.setScalar(sc);
    mat.opacity = (1 - p) * 0.78;
  };
  return g;
});

registerStageKind('pedSparkle', () => {
  const mat = new T.MeshBasicMaterial({ color: 0xfff6b8, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const m = new T.Mesh(new T.OctahedronGeometry(0.08, 0), mat);
  const g = new T.Group();
  g.add(m);
  g.userData.pose = (a) => {
    mat.opacity = a.alpha ?? 0.9;
    m.scale.setScalar(a.size || 1);
    m.rotation.y = (a.spin || 0);
  };
  return g;
});

// --------------------------------------------------------------------------- 9. sword-pedestal
const SP = {
  hold: 60,
  reachBase: 195,
  grip: 210,
  strain: 300,
  drawn: 510,
  raised: 600,
  settle: 780,
  end: 900,
};

function plazaOrigin(g) {
  const f = g.city.fountain;
  return [f.x * M, 0, f.z * M + 6.4];
}

export const swordPedestal = {
  id: 'sword-pedestal',
  title: 'Sword pedestal: Juniper pulls the blade from the plaza stone in a pillar of golden light',
  duration: SP.end,
  light: 'golden',
  bookmark: (g) => {
    const o = plazaOrigin(g);
    // Low front three-quarter: Juniper small before pedestal, sword dead center, light shaft filling top half
    return cam(o, -2.6, 0.95, 5.8, 0, 2.55, 0);
  },
  set(g) {
    const o = plazaOrigin(g);
    const crowd = [0, 1, 2, 3, 4].map((i) => {
      const ang = -2.4 + i * 0.48 + (hash(i + 10) - 0.5) * 0.15;
      const dist = 4.6 + hash(i + 30) * 1.4;
      return person('crowd' + i, townLook(i + 2), Math.sin(ang) * dist, 0, Math.cos(ang) * dist, Math.atan2(-Math.sin(ang), -Math.cos(ang)));
    });
    const sparkles = Array.from({ length: 14 }, (_, i) => thing('sp' + i, 'pedSparkle', 0, -5, 0, 0, { alpha: 0 }));
    return {
      origin: o,
      props: [],
      actors: [
        thing('pedestal', 'pedestal', 0, 0, 0, 0, { pull: 0, drawn: false, glow: 0 }),
        thing('shaft', 'lightShaft', 0, 0.8, 0, 0, { power: 0 }),
        thing('ring', 'shockRing', 0, 0.08, 0, 0, { p: -1 }),
        thing('heldSword', 'heldSword', 0, 0, 0, 0),
        person('juniper', JUNIPER, -4.4, 0, 0.2, Math.atan2(4.4, -0.2)),
        person('fen', FEN, 2.7, 0, 2.6, -Math.PI * 0.72),
        ...crowd,
        ...sparkles,
      ],
    };
  },
  act(S, t) {
    const A = Object.fromEntries(S.actors.map((a) => [a.id, a]));
    const j = A.juniper, fen = A.fen, ped = A.pedestal, shaft = A.shaft, ring = A.ring, hs = A.heldSword;
    j.pose = {}; j.vis = true;
    hs.vis = false;
    ped.pull = 0; ped.drawn = false; ped.glow = 0;
    shaft.power = 0;
    ring.p = -1;
    S.flash = 0;

    if (t < SP.hold) {
      // Opening hold: Juniper small in frame facing the glowing pedestal.
      // Spawn z=0.2 (not 4.2): the entry follow-cam sits 8.5m west of her, and
      // from z=4.2 its sightline to her passed through the plaza tree at stage
      // (-7.9, 3.4) — she was hidden in foliage on entry. At z=0.2 the line
      // clears the trunk by ~3.2m and the pedestal is straight ahead of her.
      j.x = -4.4; j.y = 0; j.z = 0.2; j.yaw = Math.atan2(4.4, -0.2);
      ped.glow = 0.25 + Math.sin(t * 0.08) * 0.1;
    } else if (t < SP.reachBase) {
      walk(j, t, [[SP.hold, -4.4, 0.2], [SP.reachBase, -0.55, 1.55]], 0.9);
      j.y = 0;
      ped.glow = 0.35;
    } else if (t < SP.grip) {
      // Steps up onto the pedestal base
      const u = ramp(t, SP.reachBase, SP.grip);
      j.x = kf(t, [[SP.reachBase, -0.55], [SP.grip, 0]]);
      j.z = kf(t, [[SP.reachBase, 1.55], [SP.grip, 0.85]]);
      j.y = 0.26 * u + Math.sin(u * Math.PI) * 0.14;
      j.yaw = Math.PI;
      j.pose.armL = [u * 1.4, -0.2 * u];
      j.pose.armR = [u * 1.4, -0.2 * u];
      ped.glow = 0.45;
    } else if (t < SP.strain) {
      // Gripping the hilt in both hands
      const u = ramp(t, SP.grip, SP.strain);
      j.x = 0; j.y = 0.26; j.z = 0.85; j.yaw = Math.PI;
      j.pose.armL = [1.55, -0.35];
      j.pose.armR = [1.55, -0.35];
      j.pose.lean = 0.18 * (1 - u * 0.4);
      ped.glow = 0.55 + u * 0.2;
    } else if (t < SP.drawn) {
      // Strain beat: sword resists, whole body shakes with effort
      const u = ramp(t, SP.strain, SP.drawn);
      const shake = Math.sin(t * 2.8) * (0.015 + u * 0.025);
      j.x = shake; j.y = 0.26; j.z = 0.85 + Math.cos(t * 3.1) * 0.012; j.yaw = Math.PI;
      j.pose.crouch = 0.25 + 0.18 * Math.sin(t * 0.5);
      j.pose.lean = -0.22 - 0.12 * u;
      j.pose.armL = [1.65 + Math.sin(t * 2.4) * 0.08, -0.38];
      j.pose.armR = [1.65 - Math.sin(t * 2.4) * 0.08, -0.38];
      j.pose.headPitch = -0.15;
      ped.pull = u * 0.12;
      ped.glow = 0.75 + u * 0.25;
      shaft.power = u * 0.35;
    } else if (t < SP.raised) {
      // Drawn: sword comes free in a pillar of light + shockwave
      const u = ramp(t, SP.drawn, SP.raised);
      j.x = 0; j.y = 0.26; j.z = 0.85; j.yaw = Math.PI;
      j.pose.lean = -0.08;
      j.pose.armL = [1.65 + u * 1.35, -0.35 * (1 - u)];
      j.pose.armR = [1.65 + u * 1.35, -0.35 * (1 - u)];
      j.pose.headPitch = -0.35 * u;
      ped.drawn = true;
      ped.glow = 1.0;
      shaft.power = 0.35 + Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.5) * 0.75;
      ring.p = (t - SP.drawn) / 95;
      S.flash = Math.max(0, 1 - (t - SP.drawn) / 36);
      hs.vis = true;
      hs.x = 0; hs.y = 1.35 + u * 0.78; hs.z = 0.42 + u * 0.22; hs.yaw = 0;
    } else {
      // Raised: held overhead, frozen for 2+ full seconds while light settles back to golden hour
      const settle = ramp(t, SP.settle, SP.end);
      j.x = 0; j.y = 0.26; j.z = 0.85; j.yaw = Math.PI;
      j.pose.armL = [3.0, 0.05];
      j.pose.armR = [3.0, 0.05];
      j.pose.headPitch = -0.3;
      ped.drawn = true;
      ped.glow = 1 - settle * 0.65;
      shaft.power = (1 - settle) * 0.9;
      hs.vis = true;
      hs.x = 0; hs.y = 2.13; hs.z = 0.64; hs.yaw = 0;
    }

    // Fen & crowd react
    const awe = ramp(t, SP.drawn, SP.drawn + 25);
    const cheer = between(t, SP.drawn + 20, SP.end) ? Math.sin(t * 0.4) * 0.15 : 0;
    fen.pose = {
      armL: [awe * (1.8 + cheer), 0.3 * awe],
      armR: [awe * 1.3, 0.2 * awe],
      lean: -0.1 * awe,
      headPitch: -0.25 * awe,
    };
    for (let i = 0; i < 5; i++) {
      const c = A['crowd' + i];
      const up = ramp(t, SP.drawn + i * 4, SP.drawn + 22 + i * 4);
      c.pose = {
        armL: [up * (2.1 + Math.sin(t * 0.5 + i) * 0.35), 0.35 * up],
        armR: [up * (2.1 - Math.sin(t * 0.5 + i) * 0.35), 0.35 * up],
        headPitch: -0.2 * up,
      };
    }

    // Sparkle burst from drawn onwards
    for (let i = 0; i < 14; i++) {
      const sp = A['sp' + i];
      if (t < SP.drawn) { sp.vis = false; continue; }
      const age = (t - SP.drawn) / 210;
      if (age >= 1) { sp.vis = false; continue; }
      sp.vis = true;
      const ang = i * 2.39996 + age * 2.2;
      const rad = 0.45 + age * (2.2 + hash(i) * 2.4);
      sp.x = Math.cos(ang) * rad;
      sp.z = Math.sin(ang) * rad;
      sp.y = 1.0 + age * (3.8 + hash(i + 50) * 2.5) + Math.sin(age * 8 + i) * 0.2;
      sp.alpha = (1 - age) * 0.95;
      sp.size = 0.6 + (1 - age) * 0.9;
      sp.spin = t * 0.15 + i;
    }
  },
  input: () => ({}),
  events: [
    { at: 0, name: 'hold' },
    { at: SP.grip, name: 'grip' },
    { at: SP.strain, name: 'strain' },
    { at: SP.drawn, name: 'drawn' },
    { at: SP.raised, name: 'raised' },
    { at: SP.end - 1, name: 'end' },
  ],
  sound: [
    { at: 0, cue: 'water', vol: 0.14 },
    { at: SP.grip, cue: 'scrape', vol: 0.45 },
    { at: SP.strain, cue: 'ooh', vol: 0.45 },
    { at: SP.strain + 90, cue: 'sting', vol: 0.55 },
    { at: SP.drawn, cue: 'chord', vol: 1.45 },
    { at: SP.drawn + 2, cue: 'brass', vol: 1.55 },
    { at: SP.drawn + 4, cue: 'whoosh', vol: 0.8 },
    { at: SP.raised, cue: 'ooh', vol: 0.75 },
    { at: SP.raised + 45, cue: 'applause', vol: 0.5 },
    { at: SP.end - 1, cue: 'water', vol: 0.15 },
  ],
};
