// node view.js <port> <out.png> <w> <h> <query> <cx,cy,cz,lx,ly,lz> [fogFar] [fov] : freeze the game and render from a free camera (asset previews)
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [port, out, w, h, q, cam, fogFar = '900', fov = '50'] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/${q}`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.evaluate(([cam, ff, fov]) => { const C = __cel, [cx, cy, cz, lx, ly, lz] = cam.split(',').map(Number);
    C.pause = true; C.camera.far = 2000; C.camera.fov = +fov; C.camera.updateProjectionMatrix(); C.camera.position.set(cx, cy, cz); C.camera.lookAt(lx, ly, lz);
    C.scene.fog.far = +ff; C.scene.fog.near = +ff * 0.6; window.__sky.position.copy(C.camera.position); window.__sky.scale.setScalar(5);
    document.querySelectorAll('body *').forEach((e) => { if (e.tagName !== 'CANVAS' && !e.querySelector('canvas') && !e.closest('canvas')) e.style.visibility = 'hidden'; }); { const cs=[...document.querySelectorAll('canvas')]; const big=cs.reduce((a,b)=>a.width*a.height>=b.width*b.height?a:b); cs.forEach((c)=>{ if (c!==big) c.style.display='none'; }); } }, [cam, fogFar, fov]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out, timeout: 120000 });
  console.log('ok', out, 'errors', errs.length, errs.join(' | '));
  await b.close();
})();
