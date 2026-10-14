// node mkthumbs.js <port> <outdir> : bake the 16 landmark full-map thumbnails from the game's own scene (clipped to each footprint, ortho 3/4 aerial, transparent); then python3 mkthumbs.py <outdir>
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs = require('fs');
const BOX = { harborplace: [-61, -31, -43, 4], constellation: [-37, -37, -25, -8], wtc: [-21, -31, -3, -13], aquarium: [5, -31, 33, -3], powerplant: [43, -31, 69, -3],
  fourseasons: [69, -71, 95, -45], pendry: [109, -31, 143, -17], fells: [137, -71, 163, -45], monument: [-33, -105, -7, -79], orioles: [-137, -37, -75, 37],
  ravens: [-137, 45, -75, 107], science: [-67, 45, -41, 71], fedhill: [-33, 45, 27, 73], domino: [69, 45, 95, 71], underarmour: [103, 45, 129, 71], fort: [137, 45, 214, 107] };
(async () => {
  const [port, out] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 480 } })).newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/?nointro=1&tod=0.08&lmhd=near`);
  await p.waitForFunction(() => window.__cel && __cel.frames > 5, null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const meta = {};
  for (const id of Object.keys(BOX)) {
    const r = await p.evaluate(({ id, bx }) => {
      const C = __cel, T = C.THREE, R = C.renderer, S = C.scene;
      C.pause = true;
      if (!window.__bk) { // one-time setup: hide everything but the static city + HD landmarks, no fog / sky / shadows
        window.__bk = { vis: S.children.map((o) => o.visible) };
        S.children.forEach((o) => { const keep = o.isLight || (o.type === 'Object3D') || (o.userData && (o.userData.meshes || o.userData.hull)) || (o.isMesh && o.material && o.material.type === 'MeshLambertMaterial'); if (!keep) o.visible = false; });
        S.fog = null; R.shadowMap.enabled = false; S.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m.needsUpdate = true; if (m.uniforms && m.uniforms.uFogF) { m.uniforms.uFogN.value = 1e5; m.uniforms.uFogF.value = 1e6; } } } });
      }
      const [x0, z0, x1, z1] = bx, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // HD groups: only the one inside this box (their hulls cannot be clipped)
      S.children.forEach((o) => { if (o.userData && o.userData.hull) { const bb = new T.Box3().setFromObject(o), c = bb.getCenter(new T.Vector3()); o.visible = c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1; } });
      S.children.forEach((o) => { if (o.isMesh && o.material && o.material.type === 'MeshBasicMaterial' && o.material.map) o.visible = o.position.x > x0 && o.position.x < x1 && o.position.z > z0 && o.position.z < z1 && o.material.opacity > 0.5; });
      R.clippingPlanes = [new T.Plane(new T.Vector3(1, 0, 0), -x0), new T.Plane(new T.Vector3(-1, 0, 0), x1), new T.Plane(new T.Vector3(0, 0, 1), -z0), new T.Plane(new T.Vector3(0, 0, -1), z1), new T.Plane(new T.Vector3(0, 1, 0), 2.5)];
      // 3/4 aerial from the south-east (isometric-ish), north stays "up the picture"
      const dir = new T.Vector3(0.55, id === 'fedhill' ? 0.42 : 0.78, id === 'domino' ? -1 : 1).normalize(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
      cam.position.set(cx + dir.x * 600, dir.y * 600, cz + dir.z * 600); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld();
      let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; const v = new T.Vector3();
      for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [-1, 85]) { v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); mnx = Math.min(mnx, v.x); mxx = Math.max(mxx, v.x); mny = Math.min(mny, v.y); mxy = Math.max(mxy, v.y); }
      cam.left = mnx; cam.right = mxx; cam.top = mxy; cam.bottom = mny; cam.updateProjectionMatrix();
      const ppm = 12, W = Math.min(2048, Math.ceil((mxx - mnx) * ppm)), H = Math.min(2048, Math.ceil((mxy - mny) * ppm));
      const rt = new T.WebGLRenderTarget(W, H, { type: T.UnsignedByteType, depthBuffer: true }); rt.texture.colorSpace = T.SRGBColorSpace;
      const oc = new T.Color(); R.getClearColor(oc); const oa = R.getClearAlpha();
      R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(S, cam);
      const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null); R.setClearColor(oc, oa); rt.dispose(); R.clippingPlanes = [];
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), id2 = g.createImageData(W, H);
      for (let y = 0; y < H; y++) id2.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      g.putImageData(id2, 0, 0);
      v.set(cx, 0.2, cz).applyMatrix4(cam.matrixWorldInverse); const ax = (v.x - mnx) / (mxx - mnx) * W, ay = (mxy - v.y) / (mxy - mny) * H;
      // footprint diamond corners in px (for map placement / scale)
      const corners = []; for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { v.set(x, 0, z).applyMatrix4(cam.matrixWorldInverse); corners.push([(v.x - mnx) / (mxx - mnx) * W, (mxy - v.y) / (mxy - mny) * H]); }
      return { url: cv.toDataURL('image/png'), W, H, ax, ay, corners, ppm };
    }, { id, bx: BOX[id] });
    fs.writeFileSync(`${out}/${id}.png`, Buffer.from(r.url.split(',')[1], 'base64')); delete r.url; meta[id] = r; console.log(id, r.W, r.H);
  }
  fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
  console.log('errors', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
