
// ======================= TOAD CITY DRONE RACER: flight collision from the real city geometry =======================
// Two orthographic passes over the finished Toad City scene (HD landmarks forced to their near LOD) write world height into a
// render target: a top-down pass keeps the HIGHEST surface per cell, a bottom-up pass keeps the LOWEST. A point is solid when
// it sits between the two. That gives roofs, smokestacks, signs and the WTC tower exact tops, and keeps the open air under
// bridges / skywalks / pier decks flyable. Ground + water come from the original groundY() / WY.
const HF = (function () {
  const X0 = -142, X1 = 222, Z0 = -112, Z1 = 112, W = 1024, H = 640; // ~0.36 m cells
  const sx = (X1 - X0) / W, sz = (Z1 - Z0) / H, YMIN = -4, YR = 160;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: {}, side: THREE.DoubleSide,
    vertexShader: `varying float vY; void main(){ vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        p = instanceMatrix * p;
      #endif
      vec4 w = modelMatrix * p; vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vY; void main(){ float h = clamp((vY - ${YMIN.toFixed(1)}) / ${YR.toFixed(1)}, 0.0, 1.0) * 65535.0;
      float hi = floor(h / 256.0), lo = h - hi * 256.0; gl_FragColor = vec4(hi / 255.0, lo / 255.0, 1.0, 1.0); }`,
  });
  mat.toneMapped = false;
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), has = new Uint8Array(W * H);
  function pass(fromAbove, out) {
    const cam = new THREE.OrthographicCamera(X0, X1, fromAbove ? -Z0 : Z1, fromAbove ? -Z1 : Z0, 0.1, 400);
    // looking straight down (-y) with +x right and +z towards the bottom of the image; from below, looking up (+y)
    if (fromAbove) { cam.position.set(0, 220, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); }
    else { cam.position.set(0, -60, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); }
    cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const px = new Uint8Array(W * H * 4);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); renderer.setRenderTarget(null);
    // map pixels to cells by un-projecting each pixel centre (robust to the camera's handedness)
    const v = new THREE.Vector3();
    const map = (i, j) => { v.set((i + 0.5) / W * 2 - 1, (j + 0.5) / H * 2 - 1, 0).unproject(cam); return [Math.floor((v.x - X0) / sx), Math.floor((v.z - Z0) / sz)]; };
    const a = map(0, 0), b = map(W - 1, H - 1); const flipX = a[0] > b[0], flipZ = a[1] > b[1];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = (j * W + i) * 4; if (px[k + 2] < 128) continue;
      const ci = flipX ? W - 1 - i : i, cj = flipZ ? H - 1 - j : j, c = cj * W + ci;
      out[c] = YMIN + (px[k] * 256 + px[k + 1]) / 65535 * YR; has[c] |= fromAbove ? 1 : 2;
    }
  }
  function build() {
    const hide = [];
    const keepOff = (o) => o === window.__sky || o === WATER || o === groundMesh || o.isSprite || o.isPoints || o.isLine ||
      (o.material && (o.material.transparent || o.material.side === THREE.BackSide || o.material.isShaderMaterial)) || (o.userData && o.userData.noHF);
    scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.visible && keepOff(o)) { hide.push(o); o.visible = false; } });
    const lod = LMHD.list.map((L) => [L, L.near.visible, L.far.visible]); for (const L of LMHD.list) { L.near.visible = true; L.far.visible = false; }
    const fog = scene.fog; scene.fog = null; const ov = scene.overrideMaterial; scene.overrideMaterial = mat; const bg = scene.background; scene.background = null;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    const t0 = performance.now(); pass(true, top); pass(false, bot);
    scene.overrideMaterial = ov; scene.fog = fog; scene.background = bg; renderer.setClearColor(cc, ca);
    for (const o of hide) o.visible = true; for (const [L, n, f] of lod) { L.near.visible = n; L.far.visible = f; }
    HF.ms = Math.round(performance.now() - t0);
  }
  const cell = (x, z) => { const i = Math.floor((x - X0) / sx), j = Math.floor((z - Z0) / sz); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
  // the floor under a point: ground/water, or the top of solid geometry when the point is above it
  const boxes = []; // analytic solids kept out of the passes (the skywalk: a car parked under it must not fill the column)
  function solidAt(x, y, z, r = 0) {
    const g = isWater(x, z) ? WY : groundY(x, z); if (y - r < g + 0.05) return 'ground';
    for (const b of boxes) if (x > b.x0 - r && x < b.x1 + r && y > b.y0 - r && y < b.y1 + r && z > b.z0 - r && z < b.z1 + r) return 'wall';
    for (let k = 0; k < 5; k++) {
      const ox = k === 1 ? r : k === 2 ? -r : 0, oz = k === 3 ? r : k === 4 ? -r : 0; const c = cell(x + ox, z + oz); if (c < 0 || has[c] !== 3) continue;
      if (y - r * 0.6 < top[c] && y + r * 0.6 > bot[c]) return 'wall';
    }
    return null;
  }
  function topAt(x, z) { const c = cell(x, z); const g = isWater(x, z) ? WY : groundY(x, z); return c >= 0 && has[c] === 3 ? Math.max(g, top[c]) : g; }
  function clearSeg(a, b, r, step = 0.6) { // first blocked point along a segment, or null
    const d = a.distanceTo(b), n = Math.max(1, Math.ceil(d / step)); const p = new THREE.Vector3();
    for (let i = 0; i <= n; i++) { p.lerpVectors(a, b, i / n); const s = solidAt(p.x, p.y, p.z, r); if (s) return { p: p.clone(), s, t: i / n }; }
    return null;
  }
  function debugCanvas() { // top heights as a grey map (QA / course design)
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const x = X0 + (i % W + 0.5) * sx, z = Z0 + (Math.floor(i / W) + 0.5) * sz; const w = isWater(x, z); let v = has[i] & 1 ? top[i] : (w ? WY : groundY(x, z));
      const k = i * 4; if (w && !(has[i] & 1)) { im.data[k] = 40; im.data[k + 1] = 90; im.data[k + 2] = 140; } else { const q = clamp(40 + v * 4, 0, 255); im.data[k] = im.data[k + 1] = im.data[k + 2] = q; if (has[i] === 3 && bot[i] > 2.2) { im.data[k] = q; im.data[k + 1] = q * 0.6; im.data[k + 2] = 200; } }
      im.data[k + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  }
  return { build, solidAt, topAt, clearSeg, debugCanvas, boxes, X0, X1, Z0, Z1, W, H, sx, sz, ms: 0, top, bot, has };
})();
