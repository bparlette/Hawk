// tools/readme_tables.mjs — prints the measured tables of README_bosses.md from tools/results_boss_<id>.json (no hand-typed numbers).
// Usage: node tools/readme_tables.mjs > /tmp/tables.md   (then pasted between the TABLES markers by tools/readme_build.mjs)
import fs from 'node:fs';
export const IDS = ['admiral_redclaw', 'big_jimmy', 'voltage_vic', 'chef_crabcake', 'arabber_al', 'pool_shark'];
const R = Object.fromEntries(IDS.map((id) => [id, JSON.parse(fs.readFileSync(`tools/results_boss_${id}.json`, 'utf8'))]));
const shots = Object.fromEntries(IDS.map((id) => [id, JSON.parse(fs.readFileSync(`tools/shots_${id}.json`, 'utf8'))]));
const f = (x, d = 3) => (+x).toFixed(d), m = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3) + ' m';
const out = [];
out.push('| Boss | Parts | Tris | Mats | Merged calls (real `mergeRig`) | Height (idle t = 0) vs META | Lowest point, all poses + blends | Cull radius (rig space) | Idle reach beyond `META.radius` | 3 attacks: strike peak u (active) | Flash merged | Console errors |');
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const id of IDS) {
  const r = R[id], b = r.budgets.zipKit, s = r.seq, a = r.attacks.each, err = shots[id].reduce((n, j) => n + j.errors.length, 0);
  out.push(`| \`${id}\` | ${b.parts} | ${b.tris.toLocaleString('en-US')} | ${b.mats} (${b.matKinds.join(' + ')}) | ${r.merge.drawCalls} (${r.merge.toonCalls} toon + ${r.merge.outlineCalls} ink) | ${f(r.idle0.height)} m vs ${r.meta.height} m (${r.idle0.heightErrPct > 0 ? '+' : ''}${r.idle0.heightErrPct} %) | ${m(s.worstMinY)} | ${f(s.worstCullR)} | ${f(r.reach.beyondRadius)} m (${r.reach.part}) | ${a.map((e) => `${e.pose} ${f(e.peakU, 2)} (${f(e.active[0], 2)}–${f(e.active[1], 2)})`).join('; ')} | ${r.merge.flashShared ? 'yes' : 'NO'} | ${err} in ${shots[id].length} renders |`);
}
out.push('| **Threshold** | ≤ 63 | ≤ 19,800 | ≤ 4 | report | ±10 % | ≥ −0.030 m | ≤ 2.6 (pass), 1.9 info | ≤ 0.35 m | peak inside active | yes | 0 |');
out.push('');
out.push('Lowest point per sequence (60 fps, real damping, `animateBoss` on; feet and weapon groups excluded as the brief allows), with the state and part that set it:');
out.push('');
out.push('| Boss | knockdown | hurt | run | atk1 | atk2 | atk3 | chain (every state back to back) |');
out.push('|---|---|---|---|---|---|---|---|');
for (const id of IDS) {
  const s = R[id].seq, c = (k) => `${m(s[k].minY)} @ ${f(s[k].at, 2)} s (${s[k].lowest})`;
  out.push(`| \`${id}\` | ${['knockdown', 'hurt', 'run', 'atk1', 'atk2', 'atk3', 'chain'].map(c).join(' | ')} |`);
}
out.push('');
out.push('Cull radius per sequence (max distance of any part from the rig-space centre (0, 0.95, 0)), and where it peaks:');
out.push('');
out.push('| Boss | knockdown | atk1 | atk2 | atk3 | chain |');
out.push('|---|---|---|---|---|---|');
for (const id of IDS) { const s = R[id].seq; out.push(`| \`${id}\` | ${['knockdown', 'atk1', 'atk2', 'atk3', 'chain'].map((k) => `${f(s[k].cullR)} @ ${f(s[k].cullAt, 2)} s (${s[k].cullWhat})`).join(' | ')} |`); }
out.push('');
out.push('Builds on the game\'s own code (`harness/realK.mjs`, which has no `basicMat` / `makeAtlas`): parts / tris, and the determinism and cache checks:');
out.push('');
out.push('| Boss | realGame parts / tris | LOD 1 parts / tris (zip kit) | Same seed → same rig | Independent of `Math.random` | Canvas: first build ops / 2nd / `{...K}` wrapper / no-document build ok |');
out.push('|---|---|---|---|---|---|');
for (const id of IDS) {
  const r = R[id], g = r.budgets.realGame, l = r.budgets['zipKit/lod1'], d = r.determinism, c = d.canvas;
  out.push(`| \`${id}\` | ${g.parts} / ${g.tris.toLocaleString('en-US')} | ${l.parts} / ${l.tris.toLocaleString('en-US')} | ${d.sameSeedEqual ? 'yes' : 'NO'} | ${d.independentOfMathRandom && !d.mathRandomInSource ? 'yes' : 'NO'} | ${c.firstBuildOps} / ${c.secondBuildOps} / ${c.wrapperKOps} / ${c.noDocumentBuildOk === true ? 'yes' : c.noDocumentBuildOk} |`);
}
out.push('');
out.push('Live-mode hooks (J-003), called with the game\'s own partial deps (`tools/check_hooks.mjs`):');
out.push('');
for (const id of IDS) {
  const h = R[id].hooks || {};
  for (const [k, v] of Object.entries(h)) out.push(`- \`${id}\` **${k}**: ${v.ok ? 'ok' : 'FAILED'}${v.parts ? `, ${v.parts} parts / ${(v.tris || 0).toLocaleString('en-US')} tris` : ''}${v.mats ? `, ${v.mats} mats` : ''}${v.minY !== undefined ? `, bounds y ${f(v.minY)} … ${f(v.maxY)} m` : ''}${v.mergedCalls ? `, merged ${v.mergedCalls} calls` : ''}${v.keys ? `, returns { ${v.keys.join(', ')} }` : ''}${v.returns ? `, returns ${v.returns}` : ''}${v.afterChase ? `, after a 2.5 s simulated chase y ${f(v.afterChase.minY)} … ${f(v.afterChase.maxY)} m` : ''}${v.message ? `, message "${v.message}"` : ''}${v.okShape !== undefined ? `, shape ${v.okShape ? 'ok' : 'BAD'}` : ''}${v.booth !== undefined ? `, booth ${v.booth}, ${v.posed} J.pose calls` : ''}${v.windowNs !== undefined ? `, window.boss_admiral_redclaw ${v.windowNs}, global ${v.global}` : ''}`);
}
console.log(out.join('\n'));
