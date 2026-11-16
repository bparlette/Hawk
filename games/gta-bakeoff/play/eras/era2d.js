// Shared 2D era renderer (Lane C, 2026-11-16) — the e1 pattern, parameterized by asset pack.
// Every bonus pack (and any future 2D era) ships the identical sheet schema as assets/e1
// (tiles/lids/flatTransparentMap, sprites/items/carModels/rotatedCarStrips, peds variants,
// link directions, hudFont glyphs + districtBar), so ONE renderer serves them all; a pack
// file (play/eras/<pack>.js) is three lines: import this factory, name the pack, export create.
//
// Differences from play/eras/e1.js, all forced by the C1 rule (REVIEW-e1: layout lives in
// the canonical level, never in an asset pack):
//   - e1.js reads parked cars + ground decals from M.viceBeachPlacements (a key only e1's
//     manifest still carries). Here they come from level.placements (play/engine/
//     level_vice.js adaptLevel: canonical vice_beach.json placements, tile units, rot
//     already radians). Pack manifests for e2+ deliberately have NO placements key and
//     this renderer never looks for one.
//   - Object-type -> sprite mapping is shared extraction metadata, identical across packs
//     (verified 2026-11-16: sprites.items rects are index-aligned in every pack — the
//     packs are restyles of one extraction). OBJECT_SPR below is e1's objectInfos table
//     reduced to the one type the ground pass draws (66, the ground decal).
//   - The pack's lighting wash (manifest.lighting[<washKey>], a 420x860 multiply/lighter
//     overlay) is drawn over the finished frame at its manifest strength — the packs'
//     daylight/dusk grade, which e1 (ungraded 1997 art) does not have.
// Everything else — PPM 12.5 framing (~33.6 m across a 420 px screen), per-frame visible-
// tile ground (no full-level bake: iOS canvas caps), filtered ground / crisp sprites,
// dressing peds, HUD in the pack's own glyph sheet, staged load diagnostics rendered on
// the fallback frame — is e1's, unchanged, so every 2D era presents identically.
const PPM = 12.5, TILE = 64;
const GPX = TILE / 4, S = PPM / GPX;
const TS = TILE * S;
const CHARH = Math.round(PPM * 41 / 21);
const KPED = CHARH / 15, KLINK = CHARH / 16;
const BUILD = "2026-11-16-lanec-1";   // version stamp for this renderer family
const OBJECT_SPR = { 66: 258 };       // object type -> sprites.items index (shared extraction metadata; see header)
const SHADOW_LIDS = new Set([97, 100, 127, 128, 129]);
const PALM_LIDS = new Set([21, 126]);
const ZONE_PAL = { r: "#526b63", s: "#c6bd8c", l: "#7c7c88", g: "#425a00", d: "#f0d8a8", p: "#29a59c", m: "#de949c", b: "#efa542", o: "#39dede", "~": "#39dede", c: "#88889a", B: "#638c94" };
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});
const headIdx = (h, n) => ((Math.round(h / (2 * Math.PI) * n) % n) + n) % n;

function rotations(src, n, S) {
  const w = src.width, h = src.height, sg = src.getContext("2d");
  if (!sg) return Array.from({ length: n }, () => mk(S, S));
  const sd = sg.getImageData(0, 0, w, h).data, out = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * 2 * Math.PI, cs = Math.cos(a), sn = Math.sin(a), c = mk(S, S), cx = c.getContext("2d"), im = cx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - S / 2 + .5, dy = y - S / 2 + .5;
      const u = Math.floor(dx * cs + dy * sn + w / 2), v = Math.floor(-dx * sn + dy * cs + h / 2);
      if (u < 0 || v < 0 || u >= w || v >= h) continue;
      const s = (v * w + u) * 4, d = (y * S + x) * 4;
      im.data[d] = sd[s]; im.data[d + 1] = sd[s + 1]; im.data[d + 2] = sd[s + 2]; im.data[d + 3] = sd[s + 3];
    }
    cx.putImageData(im, 0, 0); out.push(c);
  }
  return out;
}
function crop(img, r) { const c = mk(r.w, r.h), x = c.getContext("2d"); if (x) x.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return c; }

// PACK: asset folder under assets/ (== registry id == audio pack id). OPTS:
//   name    display name for diagnostics
//   washKey manifest.lighting key for the full-screen grade (e.g. "daylightWash"), or null
export function makeEra2D(PACK, OPTS = {}) {
  const ASSET_BASE = new URL("../../assets/" + PACK + "/", import.meta.url).href;
  const PLAN = typeof location !== "undefined" && new URLSearchParams(location.search).has("plan");
  return function create(canvas, level) {
    const ctx = canvas.getContext("2d");
    canvas.dataset.era = PACK;
    canvas.dataset.erabuild = BUILD;
    canvas.dataset.state = "loading";
    const LW = level.w * TILE, LH = level.h * TILE;
    let ready = false, M = null, IMG = {}, WASH = null, under = null, decals = [], parked = [], pedDefs = [];
    let cam = null;

    const fb = mk(level.w * 16, level.h * 16), fx = fb.getContext("2d");
    for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) { fx.fillStyle = ZONE_PAL[level.ground[ty][tx]] || "#f0f"; fx.fillRect(tx * 16, ty * 16, 16, 16); }

    const WALK_OK = new Set(["m", "s", "b", "g"]);
    function buildPeds() {
      const bases = [];
      for (let ty = 2; ty < level.h - 2 && bases.length < 16; ty += 3)
        for (let tx = 0; tx < level.w; tx++) {
          const z = level.ground[ty][tx];
          if ((z === "m" || (z === "s" && tx > 30)) && (tx * 7 + ty * 13) % 5 === 0) bases.push({ tx, ty, vert: z === "m" });
        }
      pedDefs = bases.map((b, i) => {
        let range = 0;
        const step = b.vert ? [0, 1] : [1, 0];
        for (let d = 1; d <= 3; d++) {
          const a = level.ground[b.ty + step[1] * d]?.[b.tx + step[0] * d], c = level.ground[b.ty - step[1] * d]?.[b.tx - step[0] * d];
          if (WALK_OK.has(a) && WALK_OK.has(c)) range = d; else break;
        }
        return { x: (b.tx + .5) * level.tile_m, y: (b.ty + .5) * level.tile_m, vert: b.vert, rangeM: range * level.tile_m, off: i * 3.7, vi: i };
      }).filter(p => p.rangeM > 0);
    }
    buildPeds();

    const tileRot = new Map();
    function tileCanvas(slot, rot) {
      const key = slot * 4 + rot;
      if (tileRot.has(key)) return tileRot.get(key);
      const sx = (slot % M.tiles.cols) * TILE, sy = Math.floor(slot / M.tiles.cols) * TILE;
      let c = crop(IMG.tiles, { x: sx, y: sy, w: TILE, h: TILE });
      if (rot) {
        const r = mk(TILE, TILE), x = r.getContext("2d");
        x.translate(TILE / 2, TILE / 2); x.rotate(rot * Math.PI / 2); x.imageSmoothingEnabled = false;
        x.drawImage(c, -TILE / 2, -TILE / 2); c = r;
      }
      tileRot.set(key, c); return c;
    }
    const failedAssets = [];
    async function loadAsset(name, file) {
      try { IMG[name] = await loadImg(ASSET_BASE + file + "?v=" + BUILD); }
      catch (e) { IMG[name] = null; failedAssets.push(name); }
    }
    async function load() {
      let stage = "manifest-fetch";
      const setStage = s => { stage = s; canvas.dataset.stage = s; };
      setStage(stage);
      try {
        const resp = await fetch(ASSET_BASE + "manifest.json?v=" + BUILD);
        if (!resp.ok) throw new Error("manifest HTTP " + resp.status + " for " + ASSET_BASE + "manifest.json");
        setStage("manifest-parse");
        M = await resp.json();
        setStage("manifest-validate");
        if (!M || !M.files || !M.files.tiles || !M.tiles || !M.sprites || !M.peds || !M.link || !M.hudFont)
          throw new Error("manifest parsed but files/tiles/sprites/peds/link/hudFont are missing");
        setStage("images");
        const F = M.files;
        await Promise.all([loadAsset("tiles", F.tiles), loadAsset("sprites", F.sprites),
          loadAsset("peds", F.peds), loadAsset("link", F.link), loadAsset("hud", F.hudFont)]);
        if (OPTS.washKey && M.lighting && M.lighting[OPTS.washKey]) {
          WASH = M.lighting[OPTS.washKey];
          try { IMG.wash = await loadImg(ASSET_BASE + WASH.file + "?v=" + BUILD); }
          catch (e) { IMG.wash = null; failedAssets.push("wash"); }
        }
        if (failedAssets.length) canvas.dataset.fail = failedAssets.join(",");
        if (!IMG.tiles) throw new Error("tiles sheet failed to load");
        setStage("prepare");
        prepare(); ready = true; canvas.dataset.state = "ready"; setStage("ready");
      } catch (e) {
        canvas.dataset.state = "fallback";
        const msg = e && e.message ? e.message : String(e);
        const top = e && e.stack ? (e.stack.split("\n")[1] || "").trim() : "";
        canvas.dataset.err = (stage + ": " + msg + (top ? " @ " + top : "")).slice(0, 300);
      }
    }
    function prepare() {
      const cells = level.cells, H = level.h, W = level.w, flat = M.tiles.flatTransparentMap;
      const isFlat = (tx, ty) => !!flat[cells[ty][tx][3]];
      under = new Int32Array(W * H).fill(-1); const q = [];
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!isFlat(tx, ty)) { under[ty * W + tx] = cells[ty][tx][3]; q.push(tx, ty); }
      for (let i = 0; i < q.length; i += 2) {
        const tx = q[i], ty = q[i + 1];
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || under[ny * W + nx] >= 0) continue;
          under[ny * W + nx] = under[ty * W + tx]; q.push(nx, ny);
        }
      }
      // C1: placements come from the canonical level (level.placements), never the pack.
      decals = [];
      for (const o of level.placements.objects) {
        const spr = OBJECT_SPR[o.type];
        if (spr === undefined) continue;
        const it = M.sprites.items[spr];
        decals.push({ it, bx: o.x * TILE - it.anchorX, by: o.y * TILE - it.anchorY });
      }
      const byModel = {}, stripByIdx = {};
      for (const c of M.sprites.carModels) byModel[c.model] = c.spriteIndex;
      for (const [name, st] of Object.entries(M.sprites.rotatedCarStrips)) stripByIdx[st.absIndex] = st;
      parked = IMG.sprites ? level.placements.cars.map(c => {
        const idx = byModel[c.model], k = headIdx(c.rot, 32);
        if (idx === undefined) return null;
        if (stripByIdx[idx]) { const st = stripByIdx[idx]; return { frames: st.frames, x: c.x * level.tile_m, y: c.y * level.tile_m, k }; }
        const it = M.sprites.items[idx], src = crop(IMG.sprites, it);
        return { baked: rotations(src, 32, 96), x: c.x * level.tile_m, y: c.y * level.tile_m, k };
      }).filter(Boolean) : [];
    }

    const lidSlot = lid => M.tiles.lids[lid].slot;
    function visibleTiles(camX, camY, W, H) {
      return [
        Math.max(0, Math.floor(camX / TS)), Math.min(level.w - 1, Math.floor((camX + W - 1) / TS)),
        Math.max(0, Math.floor(camY / TS)), Math.min(level.h - 1, Math.floor((camY + H - 1) / TS)),
      ];
    }
    function drawGround(camX, camY, W, H) {
      const cells = level.cells, flat = M.tiles.flatTransparentMap;
      const [tx0, tx1, ty0, ty1] = visibleTiles(camX, camY, W, H);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const lid = cells[ty][tx][3], rot = cells[ty][tx][4], f = flat[lid];
        const dx = Math.round(tx * TS) - camX, dy = Math.round(ty * TS) - camY;
        if (!lid) { ctx.fillStyle = "#f0f"; ctx.fillRect(dx, dy, TS, TS); continue; }
        if (f) {
          ctx.drawImage(tileCanvas(lidSlot(under[ty * level.w + tx]), 0), dx, dy, TS, TS);
          if (!PALM_LIDS.has(lid)) ctx.drawImage(tileCanvas(f.transparentSlot, rot), dx, dy, TS, TS);
        } else ctx.drawImage(tileCanvas(lidSlot(lid), rot), dx, dy, TS, TS);
      }
      if (IMG.sprites) for (const d of decals) {
        const dx = Math.round(d.bx * S) - camX, dy = Math.round(d.by * S) - camY;
        if (dx + d.it.w * S <= 0 || dy + d.it.h * S <= 0 || dx >= W || dy >= H) continue;
        ctx.drawImage(IMG.sprites, d.it.x, d.it.y, d.it.w, d.it.h, dx, dy, d.it.w * S, d.it.h * S);
      }
    }
    function drawCanopy(camX, camY, W, H) {
      const cells = level.cells, flat = M.tiles.flatTransparentMap;
      const [tx0, tx1, ty0, ty1] = visibleTiles(camX, camY, W, H);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const lid = cells[ty][tx][3], f = flat[lid];
        if (f && PALM_LIDS.has(lid))
          ctx.drawImage(tileCanvas(f.transparentSlot, cells[ty][tx][4]), Math.round(tx * TS) - camX, Math.round(ty * TS) - camY, TS, TS);
      }
    }
    load();

    function fitCanvas() {
      const cw = canvas.clientWidth || 420, ch = canvas.clientHeight || 860;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [cw, ch];
    }
    function drawText(text, x, y, scale, align = "left") {
      const gw = M.hudFont.cellW * scale, gh = M.hudFont.cellH * scale;
      let dx = align === "center" ? x - text.length * gw / 2 : align === "right" ? x - text.length * gw : x;
      for (const ch of text) {
        const g = M.hudFont.glyphs[ch];
        if (g) ctx.drawImage(IMG.hud, g.x, g.y, g.w, g.h, Math.round(dx), Math.round(y), gw, gh);
        dx += gw;
      }
    }
    function drawDiag(W, H) {
      const err = canvas.dataset.err || "", fail = canvas.dataset.fail || "";
      const lines = [`${PACK} build ${BUILD} — ${err ? "FALLBACK" : "loading"}`];
      if (fail) lines.push("assets failed: " + fail);
      if (err) for (let i = 0; i < err.length && lines.length < 5; i += 44) lines.push(err.slice(i, i + 44));
      ctx.font = "11px ui-monospace,Menlo,monospace"; ctx.textBaseline = "top"; ctx.imageSmoothingEnabled = true;
      const lw = Math.min(W - 16, 10 + Math.max(...lines.map(s => ctx.measureText(s).width)));
      const lh = lines.length * 14 + 8, ly = H - lh - 10;
      ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(8, ly, lw, lh);
      ctx.fillStyle = "#ffd75e";
      lines.forEach((s, i) => ctx.fillText(s, 13, ly + 4 + i * 14));
    }
    function drawHUD(sim, W, H) {
      const bar = M.hudFont.hudSprites.districtBar;
      const bx = Math.round((W - bar.w) / 2);
      ctx.drawImage(IMG.hud, bar.x, bar.y, bar.w, bar.h, bx, 6, bar.w, bar.h);
      drawText("VICE BEACH", W / 2, 9, 1, "center");
      const t = sim.t, ts = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor(t * 10 % 10)}`;
      drawText(ts, W - 8, 44, 0.75, "right");
      if (sim.finished) drawText(`THE RUN ${t.toFixed(1)}S`, W / 2, Math.round(H * 0.42), 1.5, "center");
    }
    function drawPlan(W, H) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      if (!ready) { ctx.fillStyle = "#888"; ctx.font = "16px monospace"; ctx.fillText("loading... " + PACK + " build " + BUILD, 16, 32); return; }
      const s = Math.min(W / LW, H / LH), ox = (W - LW * s) / 2, oy = (H - LH * s) / 2, td = TILE * s;
      const cells = level.cells, flat = M.tiles.flatTransparentMap;
      ctx.imageSmoothingEnabled = true;
      for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
        const lid = cells[ty][tx][3], rot = cells[ty][tx][4], f = flat[lid], dx = ox + tx * td, dy = oy + ty * td;
        if (!lid) { ctx.fillStyle = "#f0f"; ctx.fillRect(dx, dy, td, td); continue; }
        if (f) {
          ctx.drawImage(tileCanvas(lidSlot(under[ty * level.w + tx]), 0), dx, dy, td, td);
          if (!PALM_LIDS.has(lid)) ctx.drawImage(tileCanvas(f.transparentSlot, rot), dx, dy, td, td);
        } else ctx.drawImage(tileCanvas(lidSlot(lid), rot), dx, dy, td, td);
      }
      if (IMG.sprites) for (const d of decals)
        ctx.drawImage(IMG.sprites, d.it.x, d.it.y, d.it.w, d.it.h, ox + d.bx * s, oy + d.by * s, d.it.w * s, d.it.h * s);
      for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) {
        const lid = cells[ty][tx][3], f = flat[lid];
        if (f && PALM_LIDS.has(lid)) ctx.drawImage(tileCanvas(f.transparentSlot, cells[ty][tx][4]), ox + tx * td, oy + ty * td, td, td);
      }
    }

    return {
      name: OPTS.name || PACK,
      draw(sim) {
        const [W, H] = fitCanvas();
        if (PLAN) { drawPlan(W, H); return; }
        const p = sim.player(), lead = sim.mode === "drive" ? sim.car.v * 0.45 : 0;
        const tx = (p.x + Math.sin(p.h) * lead) * PPM - W / 2, ty = (p.y - Math.cos(p.h) * lead) * PPM - H / 2;
        cam = cam ? { x: cam.x + (tx - cam.x) * .12, y: cam.y + (ty - cam.y) * .12 } : { x: tx, y: ty };
        const camX = Math.round(Math.max(0, Math.min(Math.max(0, LW * S - W), cam.x)));
        const camY = Math.round(Math.max(0, Math.min(Math.max(0, LH * S - H), cam.y)));
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        const blit = (img, r, wx, wy, k = S) => ctx.drawImage(img, r.x, r.y, r.w, r.h, Math.round(wx * PPM - r.anchorX * k) - camX, Math.round(wy * PPM - r.anchorY * k) - camY, r.w * k, r.h * k);
        if (!ready) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fb, camX / PPM * 4, camY / PPM * 4, W / PPM * 4, H / PPM * 4, 0, 0, W, H);
          ctx.fillStyle = "#18b8a8"; ctx.fillRect(Math.round(sim.car.x * PPM) - camX - 20, Math.round(sim.car.y * PPM) - camY - 28, 40, 56);
          if (sim.mode !== "drive") { ctx.fillStyle = "#10ad42"; ctx.fillRect(Math.round(sim.hero.x * PPM) - camX - 8, Math.round(sim.hero.y * PPM) - camY - 8, 16, 16); }   // MERGE 2026-11-16: was "foot" only — hero vanished during the sim's enter/exit modes
          drawDiag(W, H);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        drawGround(camX, camY, W, H);
        const f = level.route.finish;
        if ((sim.tick >> 4) & 1) { ctx.fillStyle = "#f8f840"; const fs = Math.max(6, Math.round(8 * S)); ctx.fillRect(Math.round(f.x * level.tile_m * PPM) - fs / 2 - camX, Math.round(f.y * level.tile_m * PPM) - fs / 2 - camY, fs, fs); }
        ctx.imageSmoothingEnabled = false;
        if (IMG.sprites) for (const c of parked) {
          if (c.frames) { const fr = c.frames[c.k]; ctx.drawImage(IMG.sprites, fr.x, fr.y, fr.w, fr.h, Math.round(c.x * PPM - fr.anchorX * S) - camX, Math.round(c.y * PPM - fr.anchorY * S) - camY, fr.w * S, fr.h * S); }
          else { const im = c.baked[c.k]; ctx.drawImage(im, Math.round(c.x * PPM) - camX - im.width * S / 2, Math.round(c.y * PPM) - camY - im.height * S / 2, im.width * S, im.height * S); }
        }
        const variants = Object.values(M.peds.variants);
        if (IMG.peds) for (const pd of pedDefs) {
          const v = 1.15, L = pd.rangeM, dist = sim.tick / 60 * v + pd.off, u = dist % (2 * L), along = u < L ? u : 2 * L - u, fwd = u < L;
          const wx = pd.x + (pd.vert ? 0 : along - L / 2), wy = pd.y + (pd.vert ? along - L / 2 : 0);
          const dir = pd.vert ? (fwd ? "down" : "up") : (fwd ? "right" : "left");
          const fr = variants[pd.vi % variants.length].directions[dir][Math.floor(dist / 0.8) % 4];
          blit(IMG.peds, fr, wx, wy, KPED);
        }
        if (IMG.sprites) {
          const strip = M.sprites.rotatedCarStrips.sport_red, fr = strip.frames[headIdx(sim.car.h, 32)];
          ctx.drawImage(IMG.sprites, fr.x, fr.y, fr.w, fr.h, Math.round(sim.car.x * PPM - fr.anchorX * S) - camX, Math.round(sim.car.y * PPM - fr.anchorY * S) - camY, fr.w * S, fr.h * S);
        }
        if (sim.mode !== "drive" && IMG.link) {   // MERGE 2026-11-16: foot + enter + exit, as Lane A's e1 — incl. the hood-slide z lift + ground shadow
          const h = sim.hero.h, dir = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h)) ? (Math.sin(h) > 0 ? "right" : "left") : (Math.cos(h) > 0 ? "up" : "down");
          const fr2 = M.link.directions[dir][sim.hero.speed > .05 ? Math.floor(sim.hero.phase * 4) % 4 : 0];
          const z = sim.hero.z || 0;
          if (z > 0.02) {
            ctx.fillStyle = "rgba(0,0,0,.35)";
            ctx.beginPath(); ctx.ellipse(Math.round(sim.hero.x * PPM) - camX, Math.round(sim.hero.y * PPM) - camY, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
          }
          blit(IMG.link, fr2, sim.hero.x, sim.hero.y - z * 1.3, KLINK);
        }
        ctx.imageSmoothingEnabled = true;
        drawCanopy(camX, camY, W, H);
        if (WASH && IMG.wash) {
          ctx.save();
          const bm = WASH.blendMode;
          ctx.globalCompositeOperation = ["multiply", "lighter", "overlay", "screen", "soft-light"].includes(bm) ? bm : "source-over";
          ctx.globalAlpha = typeof WASH.strength === "number" ? WASH.strength : 0.45;
          ctx.drawImage(IMG.wash, 0, 0, W, H);
          ctx.restore();
        }
        if (IMG.hud) drawHUD(sim, W, H);
      },
      dispose() {},
    };
  };
}
