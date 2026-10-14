
// =====================================================================================================================================
// 11_rt_runner: SKIP, a young Toad City roof runner, built with Toad City's own rig kit (04_actors: skeleton / part / toon + ink hulls)
// and posed with its pose system (blank / runLegs / applyPose). Taller, longer-legged than Harold: red hoodie, track pants, sneakers.
// =====================================================================================================================================
const RUN_D = { hip: 0.9, torsoY: 0.05, neckY: 0.54, legX: 0.15, thigh: 0.41, shin: 0.4, shX: 0.31, shY: 0.42, upper: 0.29, fore: 0.27 };
function buildRunner() {
  const mat = toonMat(); const J = skeleton(RUN_D, mat), d = RUN_D;
  const SK = '#6f9a34', SK2 = '#d8d48a', WART = '#557a26', HOOD = '#e2412e', HOOD2 = '#a92a1c', PANT = '#232838', SHOE = '#f4f1ea', SOLE = '#e2412e';
  const skinM = toonMat({ map: WARTS }); skinM.userData.flash = mat.userData.flash; skinM.userData.flashC = mat.userData.flashC; skinM.customProgramCacheKey = () => 'psxS'; const S_ = { mat: skinM };
  // hips: track pants with a white side stripe
  part(J.hips, G.sph(0.21, 0.15, 0.17), PANT, 0, 0.02, 0);
  // torso: a cropped red hoodie (athletic, leaning), white drawstrings, a kangaroo pocket, the hood bunched at the back
  part(J.torso, G.sph(0.25, 0.31, 0.2), HOOD, 0, 0.27, 0);
  part(J.torso, G.box(0.26, 0.11, 0.06), HOOD2, 0, 0.12, 0.17);
  for (const s of [-1, 1]) part(J.torso, G.box(0.018, 0.16, 0.018), '#ffffff', s * 0.05, 0.4, 0.2, { rot: [0.15, 0, 0] });
  part(J.torso, G.sph(0.2, 0.12, 0.13), HOOD2, 0, 0.5, -0.13);
  part(J.torso, G.box(0.3, 0.035, 0.02), '#ffd23c', 0, 0.22, -0.19, { outline: false }); // reflective stripe on the back
  // head: the wide flat toad head, gold eyes with horizontal pupils, a sports headband + headphones
  const head = J.head = grp(J.neck, 0, 0, 0); head.userData.mat = mat;
  part(head, G.sph(0.28, 0.19, 0.27, 9, 6), SK, 0, 0.15, 0.03, S_);
  part(head, G.sph(0.25, 0.1, 0.22), SK2, 0, 0.07, 0.07);
  part(head, G.box(0.36, 0.022, 0.04), '#2a1a14', 0, 0.105, 0.28);
  for (const s of [-1, 1]) part(head, G.box(0.05, 0.022, 0.04), '#2a1a14', s * 0.2, 0.115, 0.25, { rot: [0, s * 0.5, s * 0.25] }); // a grin
  for (const s of [-1, 1]) {
    part(head, G.sph(0.09, 0.09, 0.09), SK, s * 0.12, 0.28, 0.12, S_);
    part(head, G.sph(0.066, 0.064, 0.045), '#f0e070', s * 0.12, 0.3, 0.19);
    part(head, G.box(0.06, 0.022, 0.02), '#121010', s * 0.12, 0.3, 0.232);
    part(head, G.box(0.09, 0.02, 0.03), SK, s * 0.12, 0.35, 0.19, { rot: [0.35, 0, 0] });
    part(head, G.cyl(0.075, 0.075, 0.05, 10), '#14101f', s * 0.27, 0.17, 0.0, { rot: [0, 0, Math.PI / 2] }); // ear cups
    part(head, G.cyl(0.05, 0.05, 0.055, 10), HOOD, s * 0.285, 0.17, 0.0, { rot: [0, 0, Math.PI / 2], outline: false });
    part(head, G.sph(0.02, 0.016, 0.016, 5, 4), WART, s * 0.2, 0.2, 0.15);
  }
  part(head, G.tor(0.27, 0.022, Math.PI), '#14101f', 0, 0.2, -0.02, { rot: [0, Math.PI / 2, 0] }); // headphone band over the top
  part(head, G.cyl(0.285, 0.285, 0.06, 14, true), '#ffd23c', 0, 0.22, 0.02, { outline: false }); // sweatband
  // arms: hoodie sleeves pushed up, toad forearms, a yellow wristband, webbed hands
  for (const k of ['L', 'R']) {
    part(J['sh' + k], G.sph(0.1, 0.1, 0.1), HOOD, 0, 0, 0);
    part(J['sh' + k], G.cap(0.075, d.upper - 0.06), HOOD, 0, -d.upper / 2, 0);
    part(J['el' + k], G.cap(0.06, d.fore - 0.06), SK, 0, -d.fore / 2, 0, S_);
    part(J['el' + k], G.cyl(0.07, 0.07, 0.05, 8), k === 'L' ? '#ffd23c' : HOOD, 0, -d.fore + 0.06, 0, { outline: false });
    part(J['ha' + k], G.sph(0.085, 0.05, 0.1), SK, 0, -0.04, 0.02, S_);
    J['sw' + k] = grp(J['ha' + k], 0, -0.05, 0);
  }
  // legs: slim track pants with white stripes, chunky sneakers with red soles
  for (const k of ['L', 'R']) {
    part(J['lg' + k], G.cap(0.095, d.thigh - 0.08), PANT, 0, -d.thigh / 2, 0);
    part(J['lg' + k], G.box(0.02, d.thigh * 0.9, 0.02), '#ffffff', (k === 'L' ? 1 : -1) * 0.095, -d.thigh / 2, 0, { outline: false });
    part(J['kn' + k], G.cap(0.08, d.shin - 0.08), PANT, 0, -d.shin / 2, 0);
    part(J['kn' + k], G.box(0.02, d.shin * 0.9, 0.02), '#ffffff', (k === 'L' ? 1 : -1) * 0.08, -d.shin / 2, 0, { outline: false });
    part(J['ft' + k], G.sph(0.1, 0.075, 0.18), SHOE, 0, -0.03, 0.07);
    part(J['ft' + k], G.box(0.17, 0.035, 0.32), SOLE, 0, -0.09, 0.07, { outline: false });
    part(J['ft' + k], G.box(0.12, 0.02, 0.1), '#14101f', 0, 0.02, 0.15, { outline: false }); // laces
  }
  J.kind = 'runner'; return J;
}
// ---------------- poses (same joint conventions as Toad City's HERO_POSES: leg x < 0 = forward, knee x > 0 = bend, shoulder x < 0 = arm forward/up) ----------------
const RPOSE = {
  idle(t) { const p = blank(); legsStance(p, 0.15, 0.32); p.y += Math.sin(t * 2.6) * 0.02;
    p.torso = [0.08, 0.15, 0]; p.neck = [-0.05, -0.15, 0]; p.shL = [0.1, 0, 0.2]; p.shR = [0.1, 0, -0.2]; p.elL = p.elR = [-0.5, 0, 0]; return p; },
  ready(t) { const p = blank(); legsStance(p, 0.18, 0.7); p.torso = [0.55, 0, 0]; p.neck = [-0.45, 0, 0]; p.shL = [-0.3, 0, 0.25]; p.shR = [0.5, 0, -0.25]; p.elL = p.elR = [-1.3, 0, 0];
    p.lgL = [-0.7, 0, 0.1]; p.knL = [0.9, 0, 0]; p.lgR = [0.3, 0, -0.1]; p.knR = [0.8, 0, 0]; p.y = -0.12 + Math.sin(t * 5) * 0.01; return p; },
  run(ph, sp) {
    const p = blank(), a = clamp(sp / 8, 0.35, 1.15); runLegs(p, ph, a);
    for (const k of ['L', 'R']) { p['lg' + k][0] *= 1.1; p['kn' + k][0] *= 1.15; }
    const s = Math.sin(ph), lean = 0.18 + 0.05 * sp;
    p.torso = [lean, s * 0.22, 0]; p.neck = [-lean * 0.8, -s * 0.15, 0]; p.hips = [0, -s * 0.12, 0];
    p.shL = [0.95 * s * a, 0, 0.12]; p.shR = [-0.95 * s * a, 0, -0.12]; p.elL = [-1.25 - 0.3 * Math.max(0, -s), 0, 0]; p.elR = [-1.25 - 0.3 * Math.max(0, s), 0, 0];
    p.y += 0.05 * a; return p;
  },
  jump(vy) { const p = blank(), up = vy > 0;
    p.lgL = [-1.25, 0, 0.1]; p.knL = [up ? 1.5 : 0.9, 0, 0]; p.lgR = [up ? 0.45 : -0.2, 0, -0.1]; p.knR = [up ? 1.1 : 1.0, 0, 0];
    p.shL = [0.7, 0, 0.5]; p.shR = [-1.6, 0, -0.4]; p.elL = [-0.6, 0, 0]; p.elR = [-0.5, 0, 0]; p.torso = [0.3, 0.1, 0]; p.neck = [-0.2, 0, 0]; return p; },
  fall(t) { const p = RPOSE.jump(-1); const w = Math.sin(t * 14); p.shL = [-1.8 + w, 0, 0.9]; p.shR = [-1.8 - w, 0, -0.9]; p.lgL = [-0.6 + w * 0.4, 0, 0.2]; p.lgR = [-0.6 - w * 0.4, 0, -0.2]; return p; },
  wallrun(ph, side) { // side +1: wall on the runner's left
    const p = RPOSE.run(ph, 9); p.tilt = [0, 0, -side * 0.42]; p.torso[2] = side * 0.12;
    if (side > 0) { p.shL = [-0.4, 0, 1.5]; p.elL = [-0.3, 0, 0]; } else { p.shR = [-0.4, 0, -1.5]; p.elR = [-0.3, 0, 0]; } return p; },
  climb(t) { const p = blank(), ph = t * 16; runLegs(p, ph, 0.9); p.tilt = [-0.12, 0, 0];
    p.shL = [-2.6 - 0.4 * Math.sin(ph), 0, 0.25]; p.shR = [-2.6 + 0.4 * Math.sin(ph), 0, -0.25]; p.elL = p.elR = [-0.5, 0, 0]; p.torso = [-0.1, 0, 0]; p.neck = [0.3, 0, 0]; return p; },
  ladder(t) { const p = blank(), ph = t * 9, s = Math.sin(ph); p.tilt = [-0.05, 0, 0];
    p.lgL = [-0.9 - 0.4 * s, 0, 0.1]; p.knL = [1.4 + 0.4 * s, 0, 0]; p.lgR = [-0.9 + 0.4 * s, 0, -0.1]; p.knR = [1.4 - 0.4 * s, 0, 0];
    p.shL = [-2.7 + 0.35 * s, 0, 0.2]; p.shR = [-2.7 - 0.35 * s, 0, -0.2]; p.elL = [-0.6 - 0.3 * s, 0, 0]; p.elR = [-0.6 + 0.3 * s, 0, 0]; p.torso = [0.1, 0, 0]; p.neck = [0.4, 0, 0]; return p; },
  hang(t) { const p = blank(); p.shL = [-3.0, 0, 0.2]; p.shR = [-3.0, 0, -0.2]; p.elL = p.elR = [-0.15, 0, 0]; p.lgL = [-0.25, 0, 0.05]; p.lgR = [0.05, 0, -0.05]; p.knL = [0.4, 0, 0]; p.knR = [0.2, 0, 0]; p.tilt = [0.05 * Math.sin(t * 6), 0, 0]; p.neck = [0.35, 0, 0]; return p; },
  mantle(u) { const p = blank(); const a = ease(clamp(u, 0, 1));
    p.shL = [lerp(-3.0, -0.4, a), 0, 0.3]; p.shR = [lerp(-3.0, -0.4, a), 0, -0.3]; p.elL = p.elR = [lerp(-0.2, -1.4, a), 0, 0];
    p.lgL = [lerp(-0.4, -1.6, a), 0, 0.1]; p.knL = [lerp(0.3, 2.0, a), 0, 0]; p.lgR = [lerp(0, -1.0, a), 0, -0.1]; p.knR = [lerp(0.2, 1.6, a), 0, 0]; p.torso = [lerp(0, 0.8, a), 0, 0]; p.neck = [-0.3, 0, 0]; return p; },
  vault(u) { const p = blank(); const a = Math.sin(clamp(u, 0, 1) * Math.PI); // a speed vault: side-on, one hand planted, legs swung through
    p.tilt = [0, 0, 0.55 * a]; p.torso = [0.4, 0.3 * a, 0]; p.shL = [-1.1, 0, 0.2 + 0.6 * a]; p.elL = [-0.15, 0, 0]; p.shR = [-0.3, 0, -1.3 * a]; p.elR = [-0.6, 0, 0];
    p.lgL = [-1.3, 0, 0.3 * a]; p.knL = [0.6, 0, 0]; p.lgR = [-1.0, 0, 0.5 * a]; p.knR = [0.9, 0, 0]; p.y = 0.05; return p; },
  slide(t) { const p = blank(); p.tilt = [-1.0, 0, 0.12]; p.ty = 0.02; p.y = -0.42;
    p.lgL = [-1.5, 0, 0.05]; p.knL = [0.25, 0, 0]; p.lgR = [-0.55, 0, -0.25]; p.knR = [1.9, 0, 0]; p.ftL = [-0.3, 0, 0];
    p.shR = [0.9, 0, -0.55]; p.elR = [-0.2, 0, 0]; p.shL = [-1.2, 0, 0.6]; p.elL = [-0.7, 0, 0]; p.torso = [0.55, -0.25, 0]; p.neck = [0.2 + 0.03 * Math.sin(t * 30), 0.2, 0]; return p; },
  roll(u) { const p = blank(); p.tilt = [clamp(u, 0, 1) * TAU, 0, 0]; p.ty = 0.35 * Math.sin(clamp(u, 0, 1) * Math.PI); p.y = -0.35;
    p.lgL = p.lgR = [-1.9, 0, 0]; p.knL = p.knR = [2.3, 0, 0]; p.shL = [-1.6, 0, 0.3]; p.shR = [-1.6, 0, -0.3]; p.elL = p.elR = [-1.6, 0, 0]; p.torso = [1.0, 0, 0]; p.neck = [0.5, 0, 0]; return p; },
  land(u) { const p = blank(); legsStance(p, 0.2, lerp(1.4, 0.4, clamp(u, 0, 1))); p.torso = [lerp(0.9, 0.2, u), 0, 0]; p.shL = [0.4, 0, 0.6]; p.shR = [0.4, 0, -0.6]; p.elL = p.elR = [-0.6, 0, 0]; return p; },
  zip(t) { const p = blank(); p.shL = [-2.95, 0, 0.12]; p.shR = [-2.95, 0, -0.12]; p.elL = p.elR = [-0.25, 0, 0];
    p.lgL = [-1.1 + 0.08 * Math.sin(t * 7), 0, 0.12]; p.knL = [1.1, 0, 0]; p.lgR = [-0.6, 0, -0.12]; p.knR = [1.4, 0, 0]; p.torso = [-0.1, 0, 0.04 * Math.sin(t * 3)]; p.neck = [0.2, 0, 0]; return p; },
  busted(t) { const p = blank(); legsStance(p, 0.2, 0.3); p.shL = [-2.7, 0, 0.5]; p.shR = [-2.7, 0, -0.5]; p.elL = p.elR = [-1.2, 0, 0]; p.torso = [-0.1, 0, 0]; p.neck = [-0.2, 0.1 * Math.sin(t * 2), 0]; return p; },
  cheer(t) { const p = blank(); legsStance(p, 0.2, 0.25); const b = Math.abs(Math.sin(t * 6)); p.y += b * 0.12;
    p.shL = [-2.9, 0, 0.35 + 0.2 * b]; p.shR = [0.2, 0, -0.4]; p.elL = [-0.2, 0, 0]; p.elR = [-1.4, 0, 0]; p.torso = [-0.15, 0.25, 0]; p.neck = [-0.25, 0.2, 0]; return p; },
};
