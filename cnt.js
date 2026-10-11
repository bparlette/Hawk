const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
  await p.goto(`http://127.0.0.1:${process.argv[2]}/?nointro=1&tod=0.1`); await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  console.log(JSON.stringify(await p.evaluate(() => { const C = __cel, cnt = (r) => { let m = 0, v = 0, s = 0; r.traverse((o) => { if (o.isMesh) { m++; if (o.visible) v++; if (o.castShadow) s++; } }); return [m, v, s]; };
    let top = { meshes: 0, other: [] }; C.scene.children.forEach((o) => { const [m, v] = cnt(o); if (m < 400) top.meshes += v; });
    return { hero: cnt(C.hero.root), partner: cnt(C.partner.root), thug0: cnt(C.enemies[0].root), thug4: cnt(C.enemies[5].root), visThugs: C.enemies.filter((e) => e.root.visible).length, sceneVisMeshes: top.meshes, sprites: C.scene.children.filter((o) => o.isSprite).length }; })));
  await b.close();
})();
