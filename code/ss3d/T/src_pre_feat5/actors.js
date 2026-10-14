  // ---------- ACTORS (new): the 16-bit game's painted atlas frames as camera-facing billboards (HD-2D style) ----------
  const SPRITE_TEX = {};
  function spriteTex(src) {
    if (SPRITE_TEX[src]) return SPRITE_TEX[src];
    const t = TEXL.load(src, (tt) => { tt.userData.ok = true; });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return (SPRITE_TEX[src] = t);
  }
  const BILL_VS = "varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}";
  const BILL_FS = "uniform sampler2D map; uniform vec4 rect; uniform float flip; uniform float flash; uniform float alpha; uniform vec3 tint; varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){ vec2 q=vec2(flip>0.5?1.0-vUv.x:vUv.x, vUv.y); vec4 c=texture2D(map, rect.xy+q*rect.zw); if(c.a<0.06) discard; c.rgb=mix(c.rgb*tint, vec3(1.0), flash); gl_FragColor=vec4(c.rgb, c.a*alpha);\n#include <colorspace_fragment>\n#include <fog_fragment>\n}";
  const BILL_GEO = new THREE.PlaneGeometry(1, 1); BILL_GEO.translate(0, 0.5, 0);
  const SHADOW_T = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(0,0,0,0.75)"); r.addColorStop(0.5, "rgba(0,0,0,0.45)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const SHADOW_M = new THREE.MeshBasicMaterial({ map: SHADOW_T, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const SHADOW_G = new THREE.PlaneGeometry(1, 1); SHADOW_G.rotateX(-Math.PI / 2);
  class Bill {
    constructor(scene) {
      this.mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, flip: { value: 0 }, flash: { value: 0 }, alpha: { value: 1 }, tint: { value: new THREE.Color(1, 1, 1) } }]),
        vertexShader: BILL_VS, fragmentShader: BILL_FS, transparent: true, depthWrite: true, fog: true,
      });
      this.mesh = new THREE.Mesh(BILL_GEO, this.mat); this.mesh.renderOrder = 2; scene.add(this.mesh);
      this.sh = new THREE.Mesh(SHADOW_G, SHADOW_M); this.sh.renderOrder = 1; scene.add(this.sh);
      this.used = false;
    }
    // fr = [x, y, w, h, anchorX?] in sheet px, k = 2D px per sheet px, face = +1/-1 on screen
    show(src, fr, k, face, gx, gy, gz, shadowW, groundY) {
      const t = spriteTex(src), im = t.image;
      if (!t.userData.ok || !im || !im.width) { this.hide(); return; }
      this.used = true; this.mesh.visible = true;
      const U = this.mat.uniforms; U.map.value = t;
      const iw = im.width, ih = im.height, [fx, fy, fw, fh] = fr, ax = fr[4] === undefined ? fw / 2 : fr[4];
      U.rect.value.set(fx / iw, 1 - (fy + fh) / ih, fw / iw, fh / ih); U.flip.value = face < 0 ? 1 : 0;
      const w = fw * k * SPRM, h = fh * k * SPRM;
      const off = (fw / 2 - ax) * k * SPRM * (face < 0 ? -1 : 1);
      this.mesh.scale.set(w, h, 1);
      this.mesh.position.set(gx + CAM.right.x * off, gy, gz + CAM.right.z * off);
      this.mesh.rotation.set(0, CAM.yaw, 0);
      if (shadowW > 0) {
        const lift = Math.max(0, gy - groundY), s = Math.max(0.35, 1 - lift / 2.5);
        this.sh.visible = true; this.sh.position.set(gx, groundY + 0.03, gz); this.sh.scale.set(shadowW * s, 1, shadowW * 0.45 * s);
      } else this.sh.visible = false;
    }
    hide() { this.mesh.visible = false; this.sh.visible = false; }
  }
  const BILLS = { pool: [], i: 0 };
  function billNext(scene) { let b = BILLS.pool[BILLS.i]; if (!b) { b = new Bill(scene); BILLS.pool.push(b); } BILLS.i++; return b; }
  // ---- light at a point (sprites are unlit billboards; they take the nearby light colour like the city does) ----
  const _c = new THREE.Color();
  function lightAt(x, y, z, out) {
    const A = CAM.amb; out.setRGB(A[0], A[1], A[2]);
    for (const L of LIGHTS.active) {
      if (!L) continue;
      const d = Math.hypot(L.x - x, (L.y - y) * 0.6, L.z - z), r = L.d * 1.15; if (d > r) continue;
      const k = (1 - d / r); _c.setHex(L.c); const s = k * k * (L.i / 30) * (L.fl || 1) * 0.9;
      out.r += _c.r * s; out.g += _c.g * s; out.b += _c.b * s;
    }
    out.r = Math.min(1.35, out.r); out.g = Math.min(1.3, out.g); out.b = Math.min(1.3, out.b);
    return out;
  }
  const shSrc = "shared_sprites.webp";
  // which sheet / frame / scale an entity shows (frame pickers reused from the 16-bit game)
  function actorSprite(e) {
    if (e === STATE.player) {
      const p = e, name = p.bro.name.toLowerCase();
      if (p.atk === "power" && p.spec && !(p.deadT > 0 || p.downT > 0 || p.hurtT > 0)) {
        const F = SPF[name]; const pr = 1 - p.attackT / p.atkDur, air = p.z > 0.5; let f;
        if (name === "lenny") f = !air && pr > 0.5 ? "land" : Math.cos(pr * Math.PI * 8) >= 0 ? "spin1" : "spin2";
        else if (name === "rafe") f = pr < 0.18 ? "dive1" : !air && pr > 0.8 ? "land" : "dive2";
        else if (name === "miko") f = air ? (Math.floor(STATE.t / 4) % 2 ? "copter2" : "copter1") : pr > 0.5 ? "land" : "copter1";
        else f = p.z <= 2 && pr > 0.3 ? "slam" : pr < 0.25 ? "vault" : "flip";
        return { src: "sp_" + name + ".webp", fr: F[f], k: TURTLE_K };
      }
      if (p.climb) return { src: "atlas_" + name + ".webp", fr: ATLAS[name][Math.floor(p.climb.t / 10) % 2 ? "jump" : "idle"], k: TURTLE_K };
      return { src: "atlas_" + name + ".webp", fr: ATLAS[name][playerFrame(p, name)], k: TURTLE_K };
    }
    if (e.type === "zap") return { src: "atlas_zap.webp", fr: ATLAS.zap[zapFrame(e)], k: ZAP_K };
    if (e.type === "ramrod") {
      if (e.mid) return { src: "atlas_scorcher.webp", fr: SCORCHER_FR[scorcherFrame(e)] || SCORCHER_FR.idle, k: SCORCHER_K };
      return { src: "atlas_ramrod.webp", fr: ATLAS.ramrod[ramrodFrame(e)], k: RAMROD_K };
    }
    const sk = L1_ENEMY_SKINS[e.type];
    if (sk) { const F = sk.frames, fr = F[skinFrame(e, F)] || F.idle, ED = edef(e); return { src: sk.img, fr, k: (sk.k || SKIN_K) * (sk.scale || 1) * (ED.scale || 1) }; }
    return { src: "atlas_ninja.webp", fr: ATLAS.ninja[ninjaFrame(e)], k: NINJA_K };
  }
  // global position of a local entity in zone z
  function entPos(z, e, out) {
    const g = toGlobal(z, e.x, e.y); out.gx = g.gx; out.gz = g.gz;
    const f = z.layer === "subway" ? subEntFloor(e, g) : z.layer === "street" ? floorAt("street", g.gx, g.gz) : z.layer === "sewer" ? (floorAt("sewer", g.gx, g.gz) ?? WORLD.SY) : z.layer === "inside" ? 0 : (floorAt("roof", g.gx, g.gz) || 0);
    out.fy = f === null || f < -30 ? (z.layer === "roof" ? 12 : 0) : f;
    out.gy = out.fy + (e.z || 0) * ZH;
    return out;
  }
  function subEntFloor(e, g) { // platform / track: actors ease between the two levels instead of popping (they hop down and climb up)
    const f = subFloor(g.gx, g.gz), t = f === null ? SUB.PY : f;
    if (e._fy === undefined || Math.abs(e._fy - t) > 3) e._fy = t;
    e._fy += (t - e._fy) * 0.2; return e._fy;
  }
  const _pos = {}, _tint = new THREE.Color();
  function drawEntities(scene) {
    BILLS.i = 0;
    const p = STATE.player, z = STATE.zone; if (!z) return;
    const face = (f) => (f || 1) * (CAM.uDot >= 0 ? 1 : -1);
    const put = (e, s, flash, alpha, shadowW, gpos) => {
      const b = billNext(scene); const P = gpos || entPos(z, e, _pos);
      b.show(s.src, s.fr, s.k, face(e.facing), P.gx, P.gy, P.gz, shadowW, P.fy);
      lightAt(P.gx, P.gy + 1, P.gz, _tint); b.mat.uniforms.tint.value.copy(_tint); b.mat.uniforms.flash.value = flash; b.mat.uniforms.alpha.value = alpha;
      return b;
    };
    // player
    if (p && !p.hidden) {
      const blink = p.inv > 0 && p.deadT === 0 && Math.floor(STATE.t / 3) % 2 === 0;
      const sk = p.sk && p.sk.on, nm = p.bro.name.toLowerCase();
      const spr = sk && p.sk.bailT > 0 ? { src: "atlas_" + nm + ".webp", fr: ATLAS[nm][p.sk.bailT > 25 ? "hurt" : "down"], k: TURTLE_K } : actorSprite(p);
      const b = put(p, spr, 0, blink ? 0.45 : 1, sk && (p.sk.air || p.sk.n[1] < 0.95) ? 0 : 0.95, { gx: p.gx, gy: p.gy + (sk && !(p.sk.bailT > 25) ? 0.1 : 0), gz: p.gz, fy: p.fy });
      if (sk && !(p.sk.bailT > 0)) { heroLean(b); b.lean = true; } else b.lean = false;
    }
    for (const e of STATE.enemies) {
      if (e.state === "fly" && e.t > 30) continue;
      let s; if (e.tele > 0 && e.type !== "ramrod" && e.type !== "zap") { const st = e.state, wt = e.walkT; e.state = "walk"; e.walkT = 0; s = actorSprite(e); e.state = st; e.walkT = wt; } else s = actorSprite(e);
      const fl = e.flash > 0 && e.flash % 2 ? 0.75 : e.warnT > 0 && Math.floor(STATE.t / 3) % 2 ? 0.28 : 0;
      const tele = e.type === "ramrod" && e.state === "tele" && Math.floor(e.t / 3) % 2;
      const b = put(e, s, tele ? 0.45 : fl, e.state === "dying" && e.t > 20 ? Math.max(0, 1 - (e.t - 20) / 40) * (e.t % 4 < 2 ? 1 : 0.5) : 1, e.type === "ramrod" ? 1.4 : 0.95);
      if (tele) b.mat.uniforms.tint.value.setRGB(1.4, 0.5, 0.4);
    }
    for (const pr of STATE.props) {
      const roll = pr.kind === "barrel" && (pr.state === "roll" || (pr.state === "thrown" && !pr.harmless));
      put(pr, { src: shSrc, fr: SHF[roll ? "barrel_side" : pr.kind], k: SH_K }, pr.flash > 0 && pr.flash % 2 ? 0.8 : 0, 1, pr.state === "held" ? 0 : 0.7);
    }
    for (const it of STATE.items) {
      if (it.life && it.life - it.t < 120 && Math.floor(it.t / 4) % 2) continue;
      const bob = it.z > 0 ? 0 : Math.sin(STATE.t * 0.12 + it.bob) * 1.5 + 3;
      const P = entPos(z, it, _pos); P.gy += bob * ZH;
      put(it, { src: shSrc, fr: SHF[it.kind], k: SH_K * (it.kind === "pizza" ? 0.85 : 1) }, Math.floor(STATE.t / 20) % 3 === 0 ? 0.25 : 0, 1, 0.6, P);
    }
    for (const s of STATE.stars) {
      const P = entPos(z, s, _pos); P.gy += (s.arc ? 0 : 0.9);
      if (s.ray) { const b = put(s, { src: RAY_SRC, fr: [0, 0, 64, 16], k: 0.45 }, 0, 1, 0, P); b.mat.uniforms.tint.value.setRGB(1, 1, 1); continue; }
      const nm = s.kind && SHF[s.kind] ? s.kind : "star";
      const b = put(s, { src: shSrc, fr: SHF[nm], k: SH_K * 0.9 }, 0, 1, s.arc ? 0.4 : 0, P);
      b.mesh.rotation.z = STATE.t * 0.5;
    }
    // drill pod (Ramrod's entrance)
    if (STATE.pod) {
      const P = entPos(z, STATE.pod, _pos); P.gy -= Math.max(0, 1 - STATE.pod.t / 60) * 3 + Math.max(0, STATE.pod.t - 150) * 0.03;
      put({ facing: -1 }, { src: "drill.webp", fr: [0, 0, 420, 263], k: 0.32 }, 0, 1, 2.2, P);
    }
    for (let i = BILLS.i; i < BILLS.pool.length; i++) BILLS.pool[i].hide();
    // rolling barrels spin; everything else stands upright
    for (let i = 0; i < BILLS.i; i++) { const m = BILLS.pool[i].mesh; if (BILLS.pool[i].lean) { BILLS.pool[i].lean = false; continue; } if (m.rotation.z && !STATE.stars.length) m.rotation.z = 0; }
  }
  const RAY_SRC = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 16; const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "rgba(255,60,30,0)"); gr.addColorStop(0.3, "#ff5a3a"); gr.addColorStop(1, "#fff2c0"); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 8, 31, 6, 0, 0, 7); g.fill(); return c.toDataURL(); })();
  // ---- STATE.fx (the reused combat code's hit sparks / dust / smoke / booms) -> 3D particles; score pops -> HUD text ----
  function fxAnchor(f) { // reused fx carry screen-style y (depth minus height): recover depth + height from the nearest actor
    let best = null, bd = 1e9;
    const cands = [STATE.player, ...STATE.enemies, ...STATE.props];
    for (const a of cands) { if (!a) continue; const d = Math.abs(a.x - f.x) + (f.y > a.y + 6 ? 40 : 0) + Math.abs(a.y - f.y) * 0.05; if (d < bd) { bd = d; best = a; } }
    const dep = best && bd < 60 ? best.y : f.y, h = Math.max(0, dep - f.y);
    const g = toGlobal(STATE.zone, f.x, dep); const sf = STATE.zone.layer === "subway" ? subFloor(g.gx, g.gz) : null; const fl = STATE.zone.layer === "sewer" ? WORLD.SY : sf !== null ? sf : STATE.player ? STATE.player.fy : 0;
    f.g = { x: g.gx, y: fl + h * ZH, z: g.gz };
  }
  function fxStep() {
    const z = STATE.zone; if (!z) return;
    const sew = z.reg === "sewer", sb = z.reg === "subway", N = sew ? PART.sfx : sb ? PART.subfx : PART.fx, A = sew ? PART.sfxg : sb ? PART.subfxg : PART.fxg;
    for (const f of STATE.fx) {
      if (f.done3) continue; f.done3 = true;
      if (f.kind === "x" || f.kind === "pop" || f.kind === "pop5" || f.kind === "pop5k") { fxAnchor(f); f.hud = true; f.done3 = true; continue; }
      fxAnchor(f); const { x, y, z: gz } = f.g;
      const k = f.kind;
      if (k === "spark" || k === "clink" || k === "wspark") {
        const col = new THREE.Color(k === "wspark" ? f.c || "#fff" : k === "clink" ? "#cfe8ff" : "#fff2a0");
        for (let i = 0; i < 9; i++) A.emit(x, y, gz, rnd(-3, 3), rnd(-1.5, 3.5), rnd(-3, 3), rnd(0.15, 0.3), rnd(0.12, 0.22), -0.3, col.r, col.g, col.b, 1);
        A.emit(x, y, gz, 0, 0, 0, 0.12, 0.9, 2, 1, 0.95, 0.8, 0.9);
      } else if (k === "dust") { for (let i = 0; i < 6; i++) N.emit(x + rnd(-0.3, 0.3), y + 0.1, gz + rnd(-0.3, 0.3), rnd(-0.8, 0.8), rnd(0.2, 0.6), rnd(-0.5, 0.5), rnd(0.4, 0.7), 0.35, 0.8, 0.55, 0.5, 0.45, 0.5); }
      else if (k === "smoke") { for (let i = 0; i < 7; i++) N.emit(x + rnd(-0.3, 0.3), y + rnd(0, 0.5), gz + rnd(-0.3, 0.3), rnd(-0.4, 0.4), rnd(0.4, 1.1), rnd(-0.4, 0.4), rnd(0.6, 1.0), 0.5, 1.0, 0.45, 0.45, 0.5, 0.6); }
      else if (k === "boom") {
        for (let i = 0; i < 18; i++) A.emit(x, y, gz, rnd(-4, 4), rnd(-1, 5), rnd(-4, 4), rnd(0.25, 0.6), rnd(0.25, 0.6), 1, 1, rnd(0.4, 0.8), 0.15, 1);
        for (let i = 0; i < 10; i++) N.emit(x + rnd(-0.5, 0.5), y + rnd(0, 1), gz + rnd(-0.5, 0.5), rnd(-1, 1), rnd(0.5, 1.5), rnd(-1, 1), rnd(0.8, 1.4), 0.8, 1.4, 0.2, 0.18, 0.2, 0.7);
      } else if (k === "ring") { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; A.emit(x, y + 0.1, gz, Math.cos(a) * 5, 0.2, Math.sin(a) * 5, 0.35, 0.25, 0, 1, 0.95, 0.75, 0.9); } }
    }
  }
