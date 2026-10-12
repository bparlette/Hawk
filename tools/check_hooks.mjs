// tools/check_hooks.mjs — exercises the live-mode hooks the game calls (J-003) with the game's own partial deps, taken from the
// real game code (harness/realK.mjs). Usage: node tools/check_hooks.mjs <id>  -> appends { hooks } to tools/results_boss_<id>.json
import fs from 'node:fs';
import { fakeDocument } from '../harness/fakedom.mjs';
globalThis.document = fakeDocument;
const { K: KG, mergeRig } = await import('../harness/realK.mjs');
const id = process.argv[2], M = await import(`../src/boss_${id}.js`), THREE = KG.THREE, out = {};
const isHull = (o) => o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide;
const stats = (root) => { let parts = 0, hulls = 0, tris = 0; const mats = new Set(); root.traverse((o) => { if (!o.isMesh) return; if (isHull(o)) { hulls++; return; } parts++; mats.add(o.material); tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); const b = new THREE.Box3().setFromObject(root); return { parts, hulls, mats: mats.size, tris, minY: +b.min.y.toFixed(3), maxY: +b.max.y.toFixed(3), zMin: +b.min.z.toFixed(3), zMax: +b.max.z.toFixed(3) }; };
const run = (name, f) => { try { out[name] = Object.assign({ ok: true }, f()); } catch (e) { out[name] = { ok: false, err: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }; } };
if (id === 'admiral_redclaw') {
  run('globals', () => ({ windowNs: typeof globalThis.boss_admiral_redclaw?.buildAdmiralRedclaw === 'function', global: typeof globalThis.buildAdmiralRedclaw === 'function' }));
  run('setPiece', () => {
    const J = globalThis.boss_admiral_redclaw.buildAdmiralRedclaw({ THREE, toonMat: KG.toonMat, outlineMat: KG.outlineMat, scale: 1 });
    const s0 = stats(J.root); KG.applyPose(J, M.POSES.atk1(0.46, J), 1e4, 1, true); M.animateBoss(J, 1, 'atk1', 0.3); J.setAngry(1);
    mergeRig(J); return { returns: 'J (J.root is the Object3D)', scale: J.root.scale.x, ...s0, mergedCalls: J.merged.length };
  });
}
const file = `tools/results_boss_${id}.json`, R = JSON.parse(fs.readFileSync(file, 'utf8')); R.hooks = out; fs.writeFileSync(file, JSON.stringify(R, null, 1));
console.log(JSON.stringify(out));
