// example_gull_thug.js — the SHAPE every delivered character module must follow (a tiny, deliberately plain example).
// No imports. Everything comes in through K (toadcity_kit.js). Forward is +Z, up is +Y, 1 unit = 1 metre, feet on y = 0.
export const META = { id: 'gull_lookout', gang: 'example', kind: 'thug', hp: 8, scale: 1.0, radius: 0.42, weapon: null };
export function buildGullLookout(K, opts = {}) {
  const { G, part, grp, skeleton, toonMat, THUG_D } = K;
  const mat = toonMat();                       // ONE toon material per rig (the game flashes it white on hits)
  const d = THUG_D, J = skeleton(d, mat);      // same joint names + lengths => the game's thug poses drive it unchanged
  const C = Object.assign({ body: '#e9ecef', wing: '#8d99a6', vest: '#2f5bd3', beak: '#f2b33d', leg: '#e0a040' }, opts.colors);
  // hips + torso
  part(J.hips, G.sph(0.22, 0.15, 0.17), C.vest, 0, 0.02, 0);
  part(J.torso, G.sph(0.27, 0.33, 0.22), C.body, 0, 0.3, 0);
  part(J.torso, G.sph(0.24, 0.26, 0.12), C.vest, 0, 0.3, 0.1);                // the gang vest (front panel)
  // head: round gull head, hooked beak with the red dot, mean brow
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.19, 0.2, 0.2), C.body, 0, 0.2, 0.02);
  part(head, G.cyl(0.0, 0.07, 0.24, 6), C.beak, 0, 0.17, 0.27, { rot: [Math.PI / 2, 0, 0] });
  part(head, G.sph(0.025, 0.025, 0.025), '#d43a2a', 0, 0.14, 0.3, { outline: false });
  for (const s of [-1, 1]) {
    part(head, G.sph(0.045, 0.05, 0.03), '#f6f2d8', s * 0.1, 0.26, 0.16, { outline: false });
    part(head, G.box(0.03, 0.03, 0.02), K.INK, s * 0.1, 0.26, 0.185, { outline: false });
    part(head, G.box(0.1, 0.025, 0.03), K.INK, s * 0.1, 0.31, 0.17, { rot: [0, 0, s * 0.35], outline: false });
  }
  // arms are wings with feather-tip "hands"; legs are thin with webbed feet
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.1, 0.1, 0.1), C.wing, 0, 0, 0);
    part(J['sh' + k], G.cap(0.08, d.upper - 0.08), C.wing, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(0.07, d.fore - 0.08), C.wing, 0, -d.fore / 2, 0);
    part(J['ha' + k], G.sph(0.06, 0.12, 0.1), '#3a3f46', 0, -0.05, 0);
    part(J['lg' + k], G.cap(0.07, d.thigh - 0.1), C.body, 0, -d.thigh / 2, 0);
    part(J['kn' + k], G.cap(0.04, d.shin - 0.1), C.leg, 0, -d.shin / 2, 0);
    part(J['ft' + k], G.sph(0.12, 0.04, 0.17), C.leg, 0, -0.03, 0.06);
  }
  J.kind = 'thug'; J.meta = META;
  return J;                                    // return the rig: J.root (THREE.Group), J.mat, the 18 joints, J.head, J.d
}
