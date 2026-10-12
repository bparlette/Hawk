// node lmview.js <port> <query> <outPrefix> <name=cx,cy,cz,lx,ly,lz> ... : one page load, many frozen free-camera renders (landmark previews)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, q, pre, ...jobs] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 900, height: 700 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/youtube|407|Proxy/i.test(m.text())) errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  await p.waitForTimeout(1000);
  await p.evaluate(() => { for (const e of document.body.querySelectorAll('*')) if (e.id !== 'gl' && !e.contains(document.getElementById('gl'))) e.style.visibility = 'hidden'; });
  for (const j of jobs) {
    const [name, cam] = j.split('=');
    await p.evaluate((cam) => { const C = __cel, [cx, cy, cz, lx, ly, lz] = cam.split(',').map(Number);
      C.pause = true; C.camera.far = 2000; C.camera.fov = 50; C.camera.aspect = innerWidth / innerHeight; C.camera.updateProjectionMatrix(); C.camera.position.set(cx, cy, cz); C.camera.lookAt(lx, ly, lz);
      C.scene.fog.far = 600; C.scene.fog.near = 360; if (window.__sky) { window.__sky.position.copy(C.camera.position); window.__sky.scale.setScalar(5); }
      C.hero.pos.set(lx, C.groundY(lx, lz), lz); }, cam);
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `${pre}${name}.png`, timeout: 120000 });
  }
  const info = await p.evaluate(() => ({ calls: __cel.renderer.info.render.calls, tris: __cel.renderer.info.render.triangles }));
  console.log('ok', JSON.stringify(info), 'errors', errs.length, errs.slice(0, 5).join(' | '));
  await b.close();
})();
