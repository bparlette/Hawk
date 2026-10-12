// tools/check_hooks.mjs — exercises the live-mode hooks the game calls (J-003) with the game's own partial deps, taken from the
// real game code (harness/realK.mjs). Usage: node tools/check_hooks.mjs <id>  -> appends { hooks } to tools/results_boss_<id>.json
import fs from 'node:fs';
import { fakeDocument } from '../harness/fakedom.mjs';
globalThis.document = fakeDocument;
const { K: KG, mergeRig } = await import('../harness/realK.mjs');
const id = process.argv[2], M = await import(`../src/boss_${id}.js`), THREE = KG.THREE, out = {};
const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const stats = (root) => { let parts = 0, hulls = 0, tris = 0; const mats = new Set(); root.traverse((o) => { if (!o.isMesh) return; if (isHull(o)) { hulls++; return; } parts++; mats.add(o.material); tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); root.updateMatrixWorld(true); const b = new THREE.Box3(); root.traverse((o) => { if (o.isMesh && !isHull(o)) { const a = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < a.count; i++) b.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld)); } }); return { parts, hulls, mats: mats.size, tris, minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), zMin: +b.min.z.toFixed(3), zMax: +b.max.z.toFixed(3) }; };
const run = (name, f) => { try { out[name] = Object.assign({ ok: true }, f()); } catch (e) { out[name] = { ok: false, err: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }; } };
if (id === 'admiral_redclaw') {
  run('globals', () => ({ windowNs: typeof globalThis.boss_admiral_redclaw?.buildAdmiralRedclaw === 'function', global: typeof globalThis.buildAdmiralRedclaw === 'function' }));
  run('setPiece', () => {
    const J = globalThis.boss_admiral_redclaw.buildAdmiralRedclaw({ THREE, toonMat: KG.toonMat, outlineMat: KG.outlineMat, scale: 1 });
    const s0 = stats(J.root); KG.applyPose(J, M.POSES.atk1(0.46, J), 1e4, 1, true); M.animateBoss(J, 1, 'atk1', 0.3); J.setAngry(1);
    mergeRig(J); return { returns: 'J (J.root is the Object3D)', scale: J.root.scale.x, ...s0, mergedCalls: J.merged.length };
  });
}
if (id === 'big_jimmy') {
  run('swimFight', () => {
    const h = M.buildBigJimmy({ THREE, toonMat: KG.toonMat, outlineMat: KG.outlineMat, addOdir: KG.addOdir, QUAL: KG.QUAL });
    const keys = Object.keys(h); const s0 = stats(h.root);
    const okShape = h.root.isObject3D && h.body.isMesh && h.soft.isMesh && h.mouth.isMesh && h.claws.length === 2 && h.claws.every((c) => c.arm.isObject3D && c.top.isObject3D && c.bot.isObject3D && c.tip.isObject3D)
      && h.legs.length === 2 && h.legs.every((l) => l.isObject3D) && h.flash.length >= 1 && h.flash.every((m) => m.userData.flash === h.flash[0].userData.flash);
    // drive it the way a swim mode would: open/close the claws, rock the legs, flash
    h.claws[0].bot.rotation.z = 0.5; h.legs[0].rotation.z = 0.2; h.flash[0].userData.flash.value = 0.8; h.root.updateMatrixWorld(true);
    const tip = new THREE.Vector3().setFromMatrixPosition(h.claws[0].tip.matrixWorld);
    return { keys, okShape, tipWorld: tip.toArray().map((v) => +v.toFixed(2)), ...s0 };
  });
}
if (id === 'voltage_vic') {
  run('rhythmStage', () => {
    const J = M.buildVoltageVic({ THREE, stage: true }); const s0 = stats(J.root);   // THREE only: the module supplies the kit's materials
    const beats = []; for (const n of ['idle', 'atk1', 'atk2', 'atk3']) for (const u of [0, 0.5, 1]) { J.pose(n, u); J.root.updateMatrixWorld(true); beats.push(n + '@' + u); }
    const m = new Set(); J.root.traverse((o) => o.isMesh && !isHull(o) && m.add(o.material.type));
    return { hasPose: typeof J.pose === 'function', booth: !!J.booth, posed: beats.length, materialTypes: [...m], ...s0 };
  });
  run('brawlWithGameKit', () => { const J = M.buildVoltageVic(KG, { seed: 7 }); mergeRig(J); return { mergedCalls: J.merged.length, basicMatFallback: J.glowMat.type }; });
}
if (id === 'arabber_al') {
  run('carChaseNoArgs', () => {
    const save = globalThis.THREE; globalThis.THREE = THREE;
    const h = M.buildArabberAl(); globalThis.THREE = save;
    const s0 = stats(h.root); let t = 0; const trace = [];
    for (const [st, k, n] of [['idle', 0, 30], ['run', 0, 60], ['run', 0.3, 10], ['run', 0.6, 10], ['run', 1, 10], ['run', 0, 30]]) for (let i = 0; i < n; i++) { t += 1 / 60; h.update(1 / 60, { t, state: st, throwK: k }); }
    h.root.updateMatrixWorld(true); const s1 = stats(h.root);
    return { keys: Object.keys(h), isObject3D: h.root.isObject3D, facingPlusZ: s0.zMax > -s0.zMin, rest: s0, afterChase: { minY: s1.minY, maxY: s1.maxY } };
  });
  run('carChaseWithDeps', () => { const h = M.buildArabberAl({ THREE, toonMat: KG.toonMat, outlineMat: KG.outlineMat, addOdir: KG.addOdir, QUAL: KG.QUAL }); h.update(1 / 60, { t: 0.5, state: 'run', throwK: 0 }); return stats(h.root); });
  run('noThreeThrows', () => { const save = globalThis.THREE; delete globalThis.THREE; let msg = ''; try { M.buildArabberAl(); } catch (e) { msg = e.message; } globalThis.THREE = save; return { message: msg }; });
}
if (id === 'pit_beef_pete') {
  run('separateTable', () => { const T = M.buildPitBeefTable(KG, {}); return { scale: T.root.scale.x, ...stats(T.root) }; });
  run('jPoseStates', () => { const J = M.buildPitBeefPete(KG, { seed: 7 }); const names = ['eat', 'full', 'hiccup', 'cheat_slide', 'atk1', 'atk2', 'atk3', 'idle'];
    for (const n of names) for (const u of [0, 0.5, 1]) J.pose(n, u); J.pose('full', 1); const puffed = +J.full.toFixed(2); J.setFull(0); mergeRig(J); return { posed: names.length * 3, puffedAtFull1: puffed, mergedCalls: J.merged.length }; });
}
if (id === 'kingpin_carl') {
  run('jPoseStates', () => { const J = M.buildKingpinCarl(KG, { seed: 7 }); const names = ['bowl', 'heckle', 'celebrate', 'sulk', 'atk1', 'atk2', 'atk3', 'idle'];
    let hidden = false; for (const n of names) for (const u of [0, 0.6, 1]) { J.pose(n, u); if (n === 'bowl' && u === 0.6) hidden = !J.ball.visible; } J.pose('idle', 0); mergeRig(J);
    return { posed: names.length * 3, ballHiddenAfterRelease: hidden, ballBackAtIdle: J.ball.visible, mergedCalls: J.merged.length }; });
}
const file = `tools/results_boss_${id}.json`, R = JSON.parse(fs.readFileSync(file, 'utf8')); R.hooks = out; fs.writeFileSync(file, JSON.stringify(R, null, 1));
console.log(JSON.stringify(out));
