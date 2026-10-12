  // =====================================================================================================
  // ---------- G: HD-2D CITY - diorama renderer: soft moon shadows, lamp/neon point lights, HDR bloom, a tilt-shift DOF from a
  // low-res blur, haze and a slow grade. The world draws into a float target; the post pass writes the scene depth back out, then
  // the pixel sprites (layer 1) draw on top, depth-tested but never blurred, so the hero always stays pixel-crisp. ----------
  // =====================================================================================================
  const HDP = { focus: 0.45, rt: null, q1: null, q2: null, e1: null, e2: null, quad: null, pscene: null, pcam: null, M: {}, shadowT: 0, w: 0, h: 0 };
  const HD_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  function hdMat(fs, uniforms, extra) {
    return new THREE.ShaderMaterial(Object.assign({ uniforms, vertexShader: HD_VS, fragmentShader: fs, depthTest: false, depthWrite: false }, extra || {}));
  }
  function hdInit() {
    // ---- soft shadows from a low moon (buildings, fire escapes, awnings, lamps all cast; the street receives) ----
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    moon.castShadow = true; moon.color.setHex(0xa8b4ff);
    const S = moon.shadow; S.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); S.bias = -0.0005; S.normalBias = 0.05; S.radius = 3;
    const sc = S.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix();
    hdMarkShadows(); setTimeout(hdMarkShadows, 1500); setTimeout(hdMarkShadows, 4000); // the cars extrude once their art loads
    // ---- post targets + passes ----
    const fl = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    HDP.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, samples: MOBILE ? 0 : 4 });
    HDP.rt.depthTexture = new THREE.DepthTexture(4, 4); HDP.rt.depthTexture.type = THREE.UnsignedIntType;
    for (const k of ["q1", "q2", "e1", "e2"]) HDP[k] = new THREE.WebGLRenderTarget(4, 4, fl);
    HDP.M.down = hdMat("uniform sampler2D t; uniform vec2 px; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(c * 0.25, 1.0); }",
      { t: { value: null }, px: { value: new THREE.Vector2() } });
    HDP.M.blur = hdMat("uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227027; c += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * 0.316216; c += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * 0.070270; gl_FragColor = vec4(c, 1.0); }",
      { t: { value: null }, dir: { value: new THREE.Vector2() } });
    HDP.M.bright = hdMat("uniform sampler2D t; uniform vec2 px; varying vec2 vUv; void main(){ vec3 c = (texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, 1.0)).rgb) * 0.25; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 1.6, l), 1.0); }",
      { t: { value: null }, px: { value: new THREE.Vector2() } });
    HDP.M.comp = hdMat([
      "uniform sampler2D tS; uniform sampler2D tB; uniform sampler2D tG; uniform sampler2D tD; uniform float focus; uniform float band; uniform float ramp; uniform float bloomK; uniform vec3 haze; uniform float aspect; varying vec2 vUv;",
      "void main(){",
      "  vec3 sharp = texture2D(tS, vUv).rgb; vec3 soft = texture2D(tB, vUv).rgb;",
      "  float d = vUv.y - focus; float t = d > 0.0 ? smoothstep(band, band + ramp * 1.5, d) * 0.92 : smoothstep(band * 0.8, band * 0.8 + ramp * 0.7, -d);", // tilt-shift: sharp band on the hero, soft top + bottom
      "  vec3 c = mix(sharp, soft, t) * 1.22;",
      "  vec3 g = texture2D(tG, vUv).rgb; c += g * bloomK + soft * 0.06;", // neon bloom + a faint halation
      "  c = mix(c, haze, clamp((vUv.y - 0.55) * 0.32, 0.0, 0.14));", // a little haze up in the towers
      "  vec2 v = (vUv - 0.5) * vec2(1.0, 1.25); c *= 1.0 - 0.42 * dot(v, v);",
      "  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, 1.08) * vec3(1.02, 0.99, 1.05);", // a touch more colour, cool shadows
      "  vec3 hi = 0.78 + 0.22 * (1.0 - exp(-(c - 0.78) / 0.22)); c = mix(c, hi, step(0.78, c));", // soft shoulder for the HDR neon
      "  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);",
      "  gl_FragDepthEXT = texture2D(tD, vUv).x;", // the world's depth, so the sprites drawn next are hidden behind lamps, cars, corners
      "  #include <colorspace_fragment>",
      "}"].join("\n"),
      { tS: { value: null }, tB: { value: null }, tG: { value: null }, tD: { value: null }, focus: { value: 0.45 }, band: { value: 0.15 }, ramp: { value: 0.3 }, bloomK: { value: 1.0 }, haze: { value: new THREE.Color(0x2a2448) }, aspect: { value: 1 } },
      { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });
    HDP.M.comp.extensions.fragDepth = true;
    HDP.pscene = new THREE.Scene(); HDP.pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    HDP.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), HDP.M.down); HDP.quad.frustumCulled = false; HDP.pscene.add(HDP.quad);
  }
  function hdMarkShadows() {
    scene.traverse((o) => {
      if (!o.isMesh || o.layers.mask !== 1) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return;
      if (m.isMeshLambertMaterial) { o.receiveShadow = true; o.castShadow = !m.transparent || m.alphaTest > 0; }
    });
    HDP.shadowT = 0;
  }
  function hdResize() {
    if (!HDP.rt) return;
    const v = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(4, v.x), h = Math.max(4, v.y);
    if (w === HDP.w && h === HDP.h) return; HDP.w = w; HDP.h = h;
    HDP.rt.setSize(w, h); HDP.rt.depthTexture.image.width = w; HDP.rt.depthTexture.image.height = h;
    const q = MOBILE ? 4 : 3; HDP.q1.setSize(Math.ceil(w / q), Math.ceil(h / q)); HDP.q2.setSize(Math.ceil(w / q), Math.ceil(h / q));
    HDP.e1.setSize(Math.ceil(w / (q * 2)), Math.ceil(h / (q * 2))); HDP.e2.setSize(Math.ceil(w / (q * 2)), Math.ceil(h / (q * 2)));
    HDP.M.comp.uniforms.aspect.value = w / h;
  }
  function hdPass(mat, out) { HDP.quad.material = mat; renderer.setRenderTarget(out); renderer.render(HDP.pscene, HDP.pcam); }
  // moon + its shadow box follow the action (a little ahead of the hero, where the camera is looking)
  const HD_SUN = new THREE.Vector3(-0.42, 0.86, 0.3).normalize(); // a high moon: towers throw half the street into shadow, not all of it
  function hdShadowFollow() {
    const p = STATE.player, on = p && STATE.scene !== "title" && STATE.scene !== "select";
    const cx = on ? p.gx + CAM.fwd.x * 10 : CAM.look.x, cz = on ? p.gz + CAM.fwd.z * 10 : CAM.look.z;
    const sx = Math.round(cx / 2) * 2, sz = Math.round(cz / 2) * 2; // snapped, so the soft edges don't crawl as you walk
    if (moon.target.position.x !== sx || moon.target.position.z !== sz || !HDP.shadowT) {
      moon.target.position.set(sx, 0, sz); moon.position.set(sx + HD_SUN.x * 130, HD_SUN.y * 130, sz + HD_SUN.z * 130);
      moon.target.updateMatrixWorld(); moon.updateMatrixWorld(); renderer.shadowMap.needsUpdate = true; HDP.shadowT = 1;
    }
  }
  // ---- the camera: raised, narrow lens, looking down the street at a 3/4 angle; follows the hero, Q/E or the buttons swing it ----
  const HDC = { D: MOBILE ? 11.5 : 14, P: 12 * DEG, FOV: 36, OFF: 58 * DEG };
  function hdCamera(dt, T, kn, snap) {
    const pv = { x: T.x, y: T.y + 1.0, z: T.z }, hd = HDC.D * Math.cos(HDC.P), up = HDC.D * Math.sin(HDC.P);
    const onEW = Math.abs(T.z) < CITY.S && Math.abs(T.x) >= CITY.S, onNS = Math.abs(T.x) < CITY.S && Math.abs(T.z) >= CITY.S;
    if (snap || CAM.hdY === undefined) { CAM.hdY = onNS ? 0 + HDC.OFF : -Math.PI / 2 + HDC.OFF; CAM.yawS = CAM.hdY; LOOK.nudge = 0; }
    // pick the street-aligned 3/4 view that keeps the camera in the open (sticky, so it only changes when it has to)
    const score = (yaw) => {
      const f = [Math.sin(yaw), -Math.cos(yaw)], hit = segHit(pv.x, pv.y, pv.z, pv.x - f[0] * hd, pv.y + up, pv.z - f[1] * hd, 0.6);
      const ax = Math.abs(f[0]) > Math.abs(f[1]) ? "x" : "z"; // looking along x = down an E-W street
      return (1 - hit) * 40 + Math.abs(wrapA(yaw - CAM.hdY)) * 1.6 + ((onEW && ax !== "x") || (onNS && ax !== "z") ? 3 : 0);
    };
    const cur = score(CAM.hdY); let best = CAM.hdY, bs = cur;
    for (let b = 0; b < 4; b++) for (const sd of [-1, 1]) { const y = wrapA(b * Math.PI / 2 + sd * HDC.OFF), sc = score(y); if (sc < bs - 0.01) { bs = sc; best = y; } }
    if (bs < cur - 2.5) CAM.hdY = best;
    // gentle swing: Q/E, the buttons, a drag or the right stick nudge the view; it settles back after a while
    if (kn) { LOOK.nudge += kn * dt * 1.15; LOOK.nudgeT = 0; }
    LOOK.nudge = clamp(LOOK.nudge, -0.85, 0.85); if ((LOOK.nudgeT += dt) > 3) LOOK.nudge *= Math.exp(-dt * 0.5);
    const want = CAM.hdY + LOOK.nudge;
    if (snap) CAM.yawS = want; CAM.yawS = wrapA(CAM.yawS + wrapA(want - CAM.yawS) * (1 - Math.exp(-dt * (kn ? 5 : 1.5))));
    const f = [Math.sin(CAM.yawS), -Math.cos(CAM.yawS)];
    _want.set(pv.x - f[0] * hd, pv.y + up, pv.z - f[1] * hd);
    const hit = segHit(pv.x, pv.y, pv.z, _want.x, _want.y, _want.z, 0.45);
    if (hit < 1) { const k = Math.max(0.28, hit - 0.04); _want.set(pv.x + (_want.x - pv.x) * k, pv.y + (_want.y - pv.y) * k, pv.z + (_want.z - pv.z) * k); }
    if (snap || !CAM.hdP) CAM.hdP = _want.clone(); else { const inward = _want.distanceTo(pv) < CAM.hdP.distanceTo(pv); CAM.hdP.lerp(_want, 1 - Math.exp(-dt * (inward ? 12 : 4))); }
    CAM.pos.copy(CAM.hdP);
    _look.set(pv.x + f[0] * 1.5, pv.y + 2.3, pv.z + f[1] * 1.5); CAM.look.copy(_look); // aim a little over the hero: he sits low, the towers rise above
    for (const b of WORLD.blds) b.want = 1;
    return HDC.FOV;
  }
  const _hv = new THREE.Vector3(), _ds = new THREE.Vector2();
  function hdRender() {
    if (!HDP.rt) { renderer.render(scene, camera); return; }
    hdResize();
    // tilt-shift focus follows the hero's height on screen
    const p = STATE.player; let fy = 0.42;
    if (p && STATE.scene !== "title" && STATE.scene !== "select") { _hv.set(p.gx, p.gy + 0.8, p.gz).project(camera); fy = clamp((_hv.y + 1) / 2, 0.2, 0.75); }
    HDP.focus += (fy - HDP.focus) * 0.15; const C = HDP.M.comp.uniforms; C.focus.value = HDP.focus;
    const title = STATE.scene === "title" || STATE.scene === "select";
    C.band.value = title ? 0.2 : 0.13; C.ramp.value = title ? 0.32 : 0.34; C.bloomK.value = MOBILE ? 0.9 : 1.1;
    // 1) world (layer 0) -> float target with depth
    camera.layers.set(0); renderer.setRenderTarget(HDP.rt); renderer.clear(); renderer.render(scene, camera);
    // 2) quarter-res copy, blurred = the DOF's soft image; 3) bright pass at an eighth, blurred = bloom
    const q = HDP.q1, e = HDP.e1;
    HDP.M.down.uniforms.t.value = HDP.rt.texture; HDP.M.down.uniforms.px.value.set(1 / HDP.w, 1 / HDP.h); hdPass(HDP.M.down, HDP.q1);
    const B = HDP.M.blur.uniforms;
    B.t.value = HDP.q1.texture; B.dir.value.set(1 / q.width, 0); hdPass(HDP.M.blur, HDP.q2);
    B.t.value = HDP.q2.texture; B.dir.value.set(0, 1 / q.height); hdPass(HDP.M.blur, HDP.q1);
    HDP.M.bright.uniforms.t.value = HDP.q2.texture; HDP.M.bright.uniforms.px.value.set(0.5 / q.width, 0.5 / q.height); hdPass(HDP.M.bright, HDP.e1);
    for (let i = 0; i < (MOBILE ? 1 : 2); i++) {
      B.t.value = HDP.e1.texture; B.dir.value.set((1 + i) / e.width, 0); hdPass(HDP.M.blur, HDP.e2);
      B.t.value = HDP.e2.texture; B.dir.value.set(0, (1 + i) / e.height); hdPass(HDP.M.blur, HDP.e1);
    }
    // 4) composite to the screen (+ the world's depth), 5) the pixel sprites on top, crisp
    C.tS.value = HDP.rt.texture; C.tB.value = HDP.q1.texture; C.tG.value = HDP.e1.texture; C.tD.value = HDP.rt.depthTexture;
    HDP.quad.material = HDP.M.comp; renderer.setRenderTarget(null); renderer.clear(); renderer.render(HDP.pscene, HDP.pcam);
    const ac = renderer.autoClear; renderer.autoClear = false; camera.layers.set(1); renderer.render(scene, camera); camera.layers.set(0); renderer.autoClear = ac;
  }
