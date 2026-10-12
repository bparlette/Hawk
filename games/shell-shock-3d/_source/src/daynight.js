  // =====================================================================================================
  // ---------- DAY / NIGHT (new): a 6-minute day. Sun + moon, sky / fog / ambient colours, street lamps + neon switch on at
  // dusk, building windows light up one by one, night shortens the rooftop sentries' sight. T skips 3 hours. ----------
  // =====================================================================================================
  const DAY = { t: +((Q.match(/[?&]time=([\d.]+)/) || [])[1] || 0.125), len: 360, el: -1, day: 0, night: 1, lamp: 1, lit: 1, dusk: 0, sunDir: new THREE.Vector3(), showT: 0, frozen: /[?&]timefreeze\b/.test(Q) };
  const _dc = new THREE.Color(), _dc2 = new THREE.Color();
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  function dayClock() { const m = Math.floor(DAY.t * 24 * 60) % 1440, h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ":" + String(mm).padStart(2, "0") + (h < 12 ? " AM" : " PM"); }
  function daySkip() { DAY.t = (DAY.t + 0.125) % 1; DAY.showT = 120; dayCompute(); SFX.menuMove && SFX.menuMove(); }
  function dayCompute() {
    const th = (DAY.t - 0.25) * Math.PI * 2; // 6 AM = sunrise in the east, noon overhead, 6 PM sunset
    DAY.el = Math.sin(th);
    DAY.sunDir.set(Math.cos(th) * 0.82, Math.sin(th), 0.42).normalize();
    DAY.day = smooth(-0.1, 0.28, DAY.el); DAY.night = 1 - DAY.day;
    DAY.dusk = Math.max(0, 1 - Math.abs(DAY.el - 0.02) / 0.22) * 0.9; // orange band around sunrise / sunset
    DAY.lamp = 1 - smooth(-0.04, 0.14, DAY.el); // lamps + neon on at dusk, off after dawn
    DAY.lit = 1 - smooth(-0.16, 0.2, DAY.el); // fraction of windows lit (they come on one by one through dusk)
  }
  dayCompute();
  function dayTick() { // one 60 Hz step (stage only)
    if (anyPressed("t")) daySkip();
    if (!DAY.frozen) DAY.t = (DAY.t + 1 / 60 / DAY.len) % 1;
    if (DAY.showT > 0) DAY.showT--;
    dayCompute();
  }
  // ---- build: sky shader, sun + moon discs, window-light masks on the painted facades ----
  const SKY_FS = "uniform sampler2D map; uniform vec2 rep; uniform float day; uniform float dusk; uniform vec3 top; uniform vec3 haze; uniform vec3 duskc; varying vec2 vUv;\nvoid main(){ vec4 t=texture2D(map, vUv*rep); vec3 c=t.rgb; float l=dot(c, vec3(0.3,0.59,0.11));\n vec3 sky=mix(haze, top, smoothstep(0.38, 0.95, vUv.y)); sky=mix(sky, duskc, dusk*(1.0-smoothstep(0.3,0.8,vUv.y)));\n vec3 dayc=mix(sky, c*1.4+sky*0.35, smoothstep(0.18, 0.5, l)*0.55);\n gl_FragColor=vec4(mix(c, dayc, day), 1.0);\n#include <colorspace_fragment>\n}";
  function buildDay() {
    if (WORLD.sky) {
      const old = WORLD.sky.material, t = old.map;
      WORLD.sky.material = new THREE.ShaderMaterial({ uniforms: { map: { value: t }, rep: { value: new THREE.Vector2(3, 1) }, day: { value: 0 }, dusk: { value: 0 }, top: { value: new THREE.Color(0x3d7fd8) }, haze: { value: new THREE.Color(0xb8cce0) }, duskc: { value: new THREE.Color(0xff8a50) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }", fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
    }
    const disc = (r, col, glow) => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, col); gr.addColorStop(glow, col); gr.addColorStop(glow + 0.04, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r, r), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.renderOrder = -9; m.frustumCulled = false; WORLD.groups.street.add(m); return m; };
    DAY.sun = disc(70, "#fff6d8", 0.3); DAY.moon = disc(40, "#e8eeff", 0.42);
    // facades: windows + neon from the painted art become an emissive mask; by day those pixels turn to dark glass
    DAY.facPending = (WORLD.facMats || []).filter(Boolean);
  }
  function dayFacades() { // once the facade images are loaded: split each into a day map + a night window/neon glow map
    if (!DAY.facPending || !DAY.facPending.length) return;
    const done = new Map();
    DAY.facPending = DAY.facPending.filter((m) => {
      const t = m.map, im = t && t.image; if (!im || !im.width) return true;
      const key = im.src || im; let pair = done.get(key) || DAY.facCache && DAY.facCache.get(key);
      if (!pair) {
        const w = Math.min(1024, im.width), h = Math.round(im.height * w / im.width), c1 = document.createElement("canvas"), c2 = document.createElement("canvas"); c1.width = c2.width = w; c1.height = c2.height = h;
        const g1 = c1.getContext("2d"), g2 = c2.getContext("2d"); g1.drawImage(im, 0, 0, w, h); const d = g1.getImageData(0, 0, w, h), D = d.data, E = g2.createImageData(w, h), Ed = E.data;
        for (let i = 0; i < D.length; i += 4) {
          const r = D[i], g = D[i + 1], b = D[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          const warm = mx > 135 && r > b + 35 && r > 120 ? smooth(135, 200, mx) : 0, neon = mx - mn > 100 && mx > 165 ? smooth(100, 160, mx - mn) : 0, cool = b > 150 && b > r + 50 ? smooth(150, 210, b) * 0.8 : 0;
          const k = Math.min(1, Math.max(warm, neon, cool));
          Ed[i] = r * k; Ed[i + 1] = g * k; Ed[i + 2] = b * k; Ed[i + 3] = 255;
          D[i] = r + (34 - r) * k * 0.85; D[i + 1] = g + (44 - g) * k * 0.85; D[i + 2] = b + (56 - b) * k * 0.85;
        }
        g1.putImageData(d, 0, 0); g2.putImageData(E, 0, 0);
        pair = [c1, c2]; done.set(key, pair); (DAY.facCache || (DAY.facCache = new Map())).set(key, pair);
      }
      const mk = (c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; x.wrapS = t.wrapS; x.wrapT = t.wrapT; x.repeat.copy(t.repeat); x.offset.copy(t.offset); x.anisotropy = t.anisotropy; return x; };
      m.userData.nightMap = t; m.userData.dayMap = mk(pair[0]);
      m.emissiveMap = mk(pair[1]); m.emissive = new THREE.Color(m.emissive && m.emissive.getHex() ? m.emissive.getHex() : 0xffffff);
      if (m.emissive.getHex() !== 0xffffff) m.userData.keepEmissive = m.emissive.clone(), m.emissive.setHex(0xffffff);
      m.userData.lit = { value: 1 };
      m.onBeforeCompile = (sh) => { // each window cell switches on at its own moment as the evening goes on
        sh.uniforms.uLit = m.userData.lit;
        sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#ifdef USE_EMISSIVEMAP\n vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv ); vec2 cell = floor(vEmissiveMapUv * vec2(28.0, 9.0)); float hsh = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453); totalEmissiveRadiance *= emissiveColor.rgb * step(hsh, uLit * 1.02);\n#endif").replace("void main() {", "uniform float uLit;\nvoid main() {");
      };
      m.needsUpdate = true; (DAY.facMats || (DAY.facMats = [])).push(m);
      return false;
    });
  }
  // ---- per render frame: light colours / directions, lamps, sky, discs ----
  function dayApply(reg, under) {
    dayFacades();
    const D = DAY, dy = D.day, nt = D.night;
    if (D.facMats) for (const m of D.facMats) {
      const useDay = D.lamp < 0.5; const want = useDay ? m.userData.dayMap : m.userData.nightMap; if (m.map !== want) { m.map = want; m.needsUpdate = true; }
      m.userData.lit.value = D.lit; m.emissiveIntensity = 0.75 * D.lamp + (m.userData.keepEmissive ? 0.15 : 0);
    }
    if (WORLD.lampHeadMat) WORLD.lampHeadMat.color.setRGB(lerp(0.55, 1, D.lamp), lerp(0.56, 0.88, D.lamp), lerp(0.6, 0.63, D.lamp));
    for (const s of WORLD.signs || []) s.material.color.setScalar(lerp(0.38, 1, D.lamp));
    if (WORLD.sky && WORLD.sky.material.uniforms) { const U = WORLD.sky.material.uniforms; U.day.value = dy; U.dusk.value = D.dusk; }
    // sun / moon discs far out along their directions
    const cp = camera.position;
    if (D.sun) { D.sun.position.copy(cp).addScaledVector(D.sunDir, 380); D.sun.lookAt(cp); D.sun.visible = !under && D.el > -0.08; D.sun.material.color.setRGB(1, lerp(0.75, 1, smooth(0, 0.3, D.el)), lerp(0.5, 1, smooth(0, 0.3, D.el))); }
    if (D.moon) { D.moon.position.copy(cp).addScaledVector(D.sunDir, -380); D.moon.lookAt(cp); D.moon.visible = !under && D.el < 0.12; D.moon.material.opacity = smooth(0.12, -0.1, D.el); }
    if (under) return;
    // key light: sun by day (warm, orange at the horizon), moon by night (cool) - the old fixed moon is the night look
    const sunUp = D.el > 0;
    if (sunUp) moon.position.copy(D.sunDir).multiplyScalar(100); else moon.position.set(-40, 80, 60); // (the moon keeps the old night direction)
    _dc.setHex(0x9fb0ff); if (sunUp) { _dc.setHex(0xfff0d8); _dc2.setHex(0xff9a58); _dc.lerp(_dc2, D.dusk); }
    moon.color.copy(_dc); moon.intensity *= sunUp ? lerp(0.6, 2.2, smooth(0, 0.35, D.el)) : 1;
    // hemisphere + fog + clear colour + sprite ambient: lerp the night values (unchanged) toward day / dusk
    const Hn = HEMI[reg] || HEMI.street;
    hemi.color.setHex(Hn[0]).lerp(_dc.setHex(0xc8dcff), dy); hemi.groundColor.setHex(Hn[1]).lerp(_dc.setHex(0x7a6a5c), dy); hemi.intensity = lerp(Hn[2], 2.3, dy);
    const Fn = FOG.street; _dc.setHex(Fn[0]).lerp(_dc2.setHex(0xa8c0dc), dy).lerp(_dc2.setHex(0xd8906a), D.dusk * 0.55);
    scene.fog.color.copy(_dc); scene.fog.density = lerp(Fn[1], 0.0052, dy); renderer.setClearColor(_dc2.copy(_dc).lerp(_dc.setHex(0x4a86d8), dy * 0.8), 1);
    const A = CAM.amb, day3 = [1.08, 1.06, 1.02]; for (let i = 0; i < 3; i++) A[i] = lerp(A[i], day3[i], dy);
  }
  function dayLightScale(L) { // how strong a pooled light is at this time of day
    if (L.lamp) return DAY.lamp; if (L.neon) return 0.2 + 0.8 * DAY.lamp; if (L.moonFill) return 0.15 + 0.85 * DAY.night; return 1;
  }
  function drawDayHUD() {
    const p = STATE.player; if (!p) return;
    const show = DAY.showT > 0 || /[?&]clock\b/.test(Q);
    const sx = W - 62, sy = 26; // top right, under the speaker (clear of the hint box + the meters at the bottom)
    ctx.globalAlpha = show ? 1 : 0.7;
    const sun = DAY.el > 0; ctx.fillStyle = sun ? "#ffd84a" : "#dfe6ff"; ctx.beginPath(); ctx.arc(sx + 4, sy + 3, 3.4, 0, 7); ctx.fill();
    if (!sun) { ctx.fillStyle = "#10101c"; ctx.beginPath(); ctx.arc(sx + 5.6, sy + 2, 3, 0, 7); ctx.fill(); }
    ptext(dayClock(), sx + 11, sy, 1, show ? "#ffe060" : "#c8ccd6", "left");
    ctx.globalAlpha = 1;
    if (DAY.showT > 0) ptext("TIME SKIP +3H", W / 2, 34, 1, "#ffe060");
  }
