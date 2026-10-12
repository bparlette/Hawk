  // =====================================================================================================
  // ---------- CAMERA STYLES (new): Q / the CAM button cycles STANDARD -> ONE-SHOT -> COMIC -> CHASE.
  //  ONE-SHOT: no fades or cuts - manholes, stairs, doors, ladders and the elevator are one continuous camera move.
  //  COMIC: halftone dots, ink outlines, chromatic offset, the 3D drawn "on twos", onomatopoeia on hits.
  //  CHASE: a low, wide, trailing rooftop camera with speed lines + FOV kick - also switches on by itself when you
  //  sprint or leap across the roofs in any style. ----------
  // =====================================================================================================
  const CAMS = { mode: Math.max(0, ["std", "oneshot", "comic", "chase"].indexOf((Q.match(/[?&]cam=([a-z]+)/) || [])[1] || "std")), names: ["STANDARD", "ONE-SHOT", "COMIC", "CHASE"], chaseK: 0, afterT: 0, wasClimb: false, fromReg: null, pops: [], frame: 0, cdir: new THREE.Vector3(1, 0, 0), lgx: 0, lgz: 0, spd: 0, vanK: 0, showT: 0 };
  const _cw = new THREE.Vector3(), _cl = new THREE.Vector3(), _cs = new THREE.Vector3(), _fp = new THREE.Vector3(), _fl = new THREE.Vector3();
  function camCycle() { CAMS.mode = (CAMS.mode + 1) % 4; CAMS.showT = 110; SFX.menuMove && SFX.menuMove(); if (CAMS.mode === 2) skHint("comic", "COMIC CAMERA", "HALFTONE + INK, DRAWN ON TWOS. EVERY HIT GETS ITS SOUND EFFECT"); }
  const oneShot = () => CAMS.mode === 1;
  function camTick(p) { // 60 Hz
    if (anyPressed("q") || CAMS.tbHit) { CAMS.tbHit = false; camCycle(); }
    if (CAMS.showT > 0) CAMS.showT--;
    if (p.climb && !CAMS.wasClimb) CAMS.fromReg = REGION.cur;
    if (!p.climb && CAMS.wasClimb) CAMS.afterT = 45;
    CAMS.wasClimb = !!p.climb; if (CAMS.afterT > 0 && !p.climb) CAMS.afterT--;
    if (CAMS.afterT === 0 && !p.climb) CAMS.fromReg = null;
    // rooftop sprint: hold a direction at full tilt and the hero opens up
    const v = inputVec(), run = p.layer === "roof" && v && v.mag > 0.8 && !p.crouch && p.attackT === 0 && !p.climb;
    p.runT = run ? (p.runT || 0) + 1 : Math.max(0, (p.runT || 0) - 3);
    const dx = p.gx - CAMS.lgx, dz = p.gz - CAMS.lgz, sp = Math.hypot(dx, dz); CAMS.lgx = p.gx; CAMS.lgz = p.gz;
    CAMS.spd = lerp(CAMS.spd, sp < 1 ? sp * 60 : 0, 0.2);
    if (sp > 0.02 && sp < 1) { _cs.set(dx / sp, 0, dz / sp); CAMS.cdir.lerp(_cs, 0.06).normalize(); }
  }
  const sprintK = (p) => (p.layer === "roof" && p.runT > 24 ? Math.min(1.42, 1 + (p.runT - 24) * 0.02) : 1);
  function chaseWanted(p) {
    if (!p || p.layer !== "roof" || p.climb || STATE.zone.layer !== "roof") return false;
    if (CAMS.mode === 3) return true;
    return p.runT > 30 || (p.z > 0 && p.runT > 8) || (p.fy + p.z * ZH > 8 && p.fy < -1); // sprinting, leaping, or falling into an alley
  }
  // final camera = the standard follow pose (kept for the stick basis), blended toward chase / van poses
  function camFinal(dt, p, z) {
    CAMS.chaseK = lerp(CAMS.chaseK, chaseWanted(p) ? 1 : 0, 1 - Math.exp(-dt * (chaseWanted(p) ? 2.6 : 1.8)));
    CAMS.vanK = lerp(CAMS.vanK, VAN.on ? 1 : 0, 1 - Math.exp(-dt * 3));
    _fp.copy(CAM.pos); _fl.copy(CAM.look);
    let fov = CAM.fov;
    if (CAMS.chaseK > 0.002) {
      // trailing: behind the run direction, swung partway from the street-side view so the sprite still reads
      const sx = CAM.pos.x - p.gx, sz = CAM.pos.z - p.gz, sl = Math.hypot(sx, sz) || 1;
      _cs.set(-CAMS.cdir.x * 0.72 + sx / sl * 0.5, 0, -CAMS.cdir.z * 0.72 + sz / sl * 0.5).normalize();
      _cw.set(p.gx + _cs.x * 4.3, p.gy + 1.25, p.gz + _cs.z * 4.3);
      _cl.set(p.gx + CAMS.cdir.x * 6.5, p.gy + 1.15, p.gz + CAMS.cdir.z * 6.5);
      const k = CAMS.chaseK * CAMS.chaseK * (3 - 2 * CAMS.chaseK);
      _fp.lerp(_cw, k); _fl.lerp(_cl, k); fov += k * (14 + Math.min(8, CAMS.spd * 1.2));
    }
    if (CAMS.vanK > 0.002) { const V = vanCamPose(dt); const k = CAMS.vanK; _fp.lerp(V.pos, k); _fl.lerp(V.look, k); fov = lerp(fov, V.fov, k); }
    camera.position.copy(_fp);
    if (STATE.shake > 0) { const s = Math.min(0.25, STATE.shake * 0.012); camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s); }
    camera.lookAt(_fl);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // the stick follows the standard view, so steering never spins with the chase / van camera
    CAM.sf.set(CAM.look.x - CAM.pos.x, 0, CAM.look.z - CAM.pos.z); if (CAM.sf.lengthSq() < 1e-6) CAM.sf.set(0, 0, -1); CAM.sf.normalize();
    CAM.sr.set(-CAM.sf.z, 0, CAM.sf.x);
  }
  // ---- COMIC post-process ----
  const COMIC_FS = `uniform sampler2D tCol; uniform sampler2D tDep; uniform vec2 res; uniform float cn; uniform float cf; uniform float seed; varying vec2 vUv;
float lin(float d){ float z=d*2.0-1.0; return 2.0*cn*cf/(cf+cn-z*(cf-cn)); }
float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
void main(){
  vec2 px = 1.0/res; vec2 uv = vUv;
  vec2 off = (uv-0.5)*0.007 + vec2(0.0018, 0.0);
  vec3 c = vec3(texture2D(tCol, uv+off).r, texture2D(tCol, uv).g, texture2D(tCol, uv-off).b);
  vec3 s = pow(max(c, 0.0), vec3(1.0/2.2));                       // to display space for the print look
  s = floor(s*6.0 + 0.5)/6.0;                                       // flat poster tones
  float cs = max(3.5, res.y/150.0);
  vec2 p = gl_FragCoord.xy; vec2 q = mat2(0.7071,-0.7071,0.7071,0.7071)*p/cs; vec2 f = fract(q)-0.5;
  float L = lum(s); float rad = sqrt(max(0.0, 1.0-L))*0.6;
  float dotv = 1.0 - smoothstep(rad-0.06, rad+0.06, length(f));
  s = mix(s*1.15, s*0.42, dotv*0.6);
  // magenta / cyan offset print dots in the light areas
  vec2 q2 = mat2(0.9659,-0.2588,0.2588,0.9659)*p/(cs*1.4); float d2 = 1.0 - smoothstep(0.18, 0.26, length(fract(q2)-0.5));
  s = mix(s, s*vec3(1.08,0.9,1.06), d2*L*0.35);
  // ink: depth + colour edges
  float d0 = lin(texture2D(tDep, uv).r);
  float dd = abs(lin(texture2D(tDep, uv+vec2(px.x*1.5,0.0)).r)-d0) + abs(lin(texture2D(tDep, uv-vec2(px.x*1.5,0.0)).r)-d0) + abs(lin(texture2D(tDep, uv+vec2(0.0,px.y*1.5)).r)-d0) + abs(lin(texture2D(tDep, uv-vec2(0.0,px.y*1.5)).r)-d0);
  float ed = smoothstep(0.06, 0.16, dd/max(d0,0.5));
  float l0 = lum(c), lc = abs(lum(texture2D(tCol, uv+vec2(px.x,0.0)).rgb)-l0) + abs(lum(texture2D(tCol, uv+vec2(0.0,px.y)).rgb)-l0);
  float ec = smoothstep(0.08, 0.2, lc);
  s = mix(s, vec3(0.05,0.03,0.08), clamp(max(ed, ec*0.8), 0.0, 1.0));
  gl_FragColor = vec4(s, 1.0);
}`;
  function comicSetup() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (CAMS.rt && CAMS.rt.width === size.x && CAMS.rt.height === size.y) return;
    if (CAMS.rt) { CAMS.rt.dispose(); CAMS.rt.depthTexture && CAMS.rt.depthTexture.dispose(); }
    const dt = new THREE.DepthTexture(size.x, size.y); dt.type = THREE.UnsignedIntType;
    CAMS.rt = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: dt, depthBuffer: true, samples: 0 });
    if (!CAMS.post) {
      CAMS.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); CAMS.postScene = new THREE.Scene();
      CAMS.post = new THREE.ShaderMaterial({ uniforms: { tCol: { value: null }, tDep: { value: null }, res: { value: new THREE.Vector2() }, cn: { value: 0.2 }, cf: { value: 900 }, seed: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }", fragmentShader: COMIC_FS, depthTest: false, depthWrite: false });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), CAMS.post); q.frustumCulled = false; CAMS.postScene.add(q);
    }
    CAMS.rtFresh = false;
  }
  function renderFinal() {
    if (CAMS.mode !== 2) { renderer.render(scene, camera); return; }
    comicSetup();
    CAMS.frame++;
    if (!CAMS.rtFresh || CAMS.frame % 2 === 0) { renderer.setRenderTarget(CAMS.rt); renderer.render(scene, camera); renderer.setRenderTarget(null); CAMS.rtFresh = true; } // on twos
    const U = CAMS.post.uniforms; U.tCol.value = CAMS.rt.texture; U.tDep.value = CAMS.rt.depthTexture; U.res.value.set(CAMS.rt.width, CAMS.rt.height); U.cn.value = camera.near; U.cf.value = camera.far;
    renderer.render(CAMS.postScene, CAMS.postCam);
  }
  // ---- onomatopoeia ----
  const COMIC_WORDS = ["THWACK!", "KRAK!", "POW!", "WHAM!", "BAM!", "SMAK!", "KA-CHUNK!", "THOOM!", "BIFF!"];
  function comicPop(gx, gy, gz, word) {
    if (CAMS.mode !== 2) return;
    CAMS.pops.push({ gx, gy, gz, w: word || COMIC_WORDS[(Math.random() * COMIC_WORDS.length) | 0], t: 0, rot: rnd(-0.3, 0.3), c: ["#ffe14a", "#ff5ab4", "#5ae0ff", "#ff8c1a"][(Math.random() * 4) | 0] });
    if (CAMS.pops.length > 6) CAMS.pops.shift();
  }
  function comicHit(p) { // the newest foe in the hit set gets the sound effect
    if (CAMS.mode !== 2 || !p.hitSet) return; let last = null; for (const o of p.hitSet) if (isFoe(o)) last = o;
    if (last) { const g = entPos(STATE.zone, last, {}); comicPop(g.gx, g.gy + 1.5, g.gz); }
  }
  function drawCamHUD() {
    const p = STATE.player;
    // speed lines (chase)
    if (CAMS.chaseK > 0.25) {
      const a = (CAMS.chaseK - 0.25) / 0.75; ctx.save(); ctx.strokeStyle = "rgba(255,255,255," + (0.55 * a).toFixed(3) + ")"; ctx.lineWidth = 1;
      const cx = W / 2, cy = H * 0.46;
      for (let i = 0; i < 26; i++) { const an = (i * 2.399 + Math.floor(STATE.t / 2) * 0.7) % (Math.PI * 2), r0 = 120 + ((i * 37 + STATE.t * 5) % 60), r1 = r0 + 40 + (i % 3) * 25; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.7); ctx.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1 * 0.7); ctx.stroke(); }
      ctx.restore();
    }
    // comic pops: jagged burst + outlined word
    for (const q of CAMS.pops) {
      q.t++; const s = project(q.gx, q.gy, q.gz); if (!s.ok) continue;
      const k = Math.min(1, q.t / 5), sc = (q.t < 5 ? 0.5 + k * 0.7 : 1.2 - Math.min(0.2, (q.t - 5) * 0.01)), fade = q.t > 40 ? Math.max(0, 1 - (q.t - 40) / 15) : 1;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(s.x, s.y - 16 - q.t * 0.25); ctx.rotate(q.rot); ctx.scale(sc * 0.72, sc * 0.72);
      const n = 14, w = q.w.length * 6.5 + 14; ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const an = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.62 : 1; ctx.lineTo(Math.cos(an) * w * 0.62 * r, Math.sin(an) * 17 * r); }
      ctx.closePath(); ctx.fillStyle = q.c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.stroke();
      ptext(q.w, 1, -4, 1, "#000"); ptext(q.w, 0, -5, 1, "#e8102a");
      ctx.restore();
    }
    CAMS.pops = CAMS.pops.filter((q) => q.t < 56);
    if (CAMS.mode === 2) { ctx.save(); ctx.strokeStyle = "#000"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W - 3, H - 3); ctx.restore(); }
    if (CAMS.showT > 0) { const a = Math.min(1, CAMS.showT / 20); ctx.globalAlpha = a; rect(W / 2 - 70, 88, 140, 22, "rgba(0,0,0,0.75)"); ptext("CAMERA: " + CAMS.names[CAMS.mode], W / 2, 92, 1, "#ffe060"); ptext(["CLASSIC FOLLOW", "NO CUTS - ONE CONTINUOUS SHOT", "HALFTONE + INK, ON TWOS", "ROOFTOP CHASE CAM"][CAMS.mode], W / 2, 102, 1, "#c8ccd6"); ctx.globalAlpha = 1; }
    camButton(STATE.scene === "stage" && STATE.showTouch);
  }
  function camButton(on) {
    const scr = document.getElementById("screen"); if (!scr) return;
    if (!CAMS.btn) {
      const b = document.createElement("div"); b.className = "ss-tb ss-tb-cam"; b.textContent = "CAM"; b.setAttribute("role", "button"); b.setAttribute("aria-label", "Cycle camera style");
      b.addEventListener("pointerdown", (ev) => { ev.preventDefault(); ev.stopPropagation(); CAMS.tbHit = true; b.classList.add("on"); STATE.showTouch = true; });
      const up = (ev) => { ev.stopPropagation(); b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
      scr.appendChild(b); CAMS.btn = b;
    }
    const v = on ? "flex" : "none"; if (CAMS.btn.style.display !== v) CAMS.btn.style.display = v;
  }
