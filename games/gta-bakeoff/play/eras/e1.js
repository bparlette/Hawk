// Era 1 — GTA 1 (1997). Canvas2D, straight-down top-down, real decoded Vice City art.
// Tiles are the native 64x64 GTA 1 lids from assets/e1/tiles.png, drawn per frame at
// PPM px per metre (12.5 since build -6, ~50 px per tile) with smoothing on the
// ground layer: The Original presents this same art filtered in WebGL, and
// nearest-neighbour at 64 px/tile turns the paving tiles' fine grout grid into a hard
// checkerboard and the road tiles' contour shading into harsh stripes. Sprites stay
// crisp (smoothing off), like The Original's sprite texture.
// Vehicles/peds/Link/HUD all come from assets/e1/ via manifest.json — nothing is
// redrawn from imagination. Layout comes only from level.cells (canonical vice_beach.json via
// play/engine/level_vice.js); this file never hard-codes a street.
//
// Flat overlay lids (palms, bridge decks, building shadows — manifest tiles.flatTransparentMap)
// layer over an inferred ground tile: the canonical extraction keeps only the surface lid, so
// the ground under a flat overlay is taken from the nearest non-flat cell (multi-source BFS,
// deterministic). Shadows and bridge decks layer into the ground pass; palm canopies draw
// in a separate overhead pass after the sprites, like the real game. The ground is drawn
// tile-by-tile for the visible region only: the original full-level bake canvas was
// 4096x5056 px (~20.7M px), over iOS Safari's canvas caps (4096 px/dimension, ~16.7M px
// area), so on iPhones its 2D context failed, bake() threw, and the game silently stayed
// on the flat fallback forever (Nov 15, 2026 — see STATUS.md).
//
// Build 2026-11-15-5 — the phone-truth build. The bake fix above was serve-verified,
// yet Cherie's iPhone STILL showed the fallback (Nov 15, 18:13 ET), with two live
// suspects: (A) the in-app browser serving the OLD module graph from cache — the
// imports carried no version stamp — or (B) a second load-path failure the canvas-cap
// simulation does not model. So now: every module import in the play chain carries
// ?v=<BUILD>; load() records the actual error (stage + message + top stack frame) in
// canvas.dataset.e1err, and the fallback frame RENDERS the build tag + error on
// screen. A phone screenshot then discriminates all three outcomes: no box at all =
// cached pre-diagnostic code; box with an error = that error is the real throw;
// textured game = fixed. Each asset also loads independently (canvas.dataset.e1fail
// lists failures); only the tile sheet gates the textured path — a missing
// sprite/ped/link/HUD sheet degrades just that layer instead of stranding the whole
// renderer on the fallback.
//
// Build 2026-11-15-5 — THE PHONE SPOKE, and it was neither suspect. Cherie's screenshot
// showed the box: stage "manifest", error "The string did not match the expected
// pattern." That is WebKit's canned SyntaxError DOMException for a failed
// Response.json() body extraction — the manifest fetch had resolved to a 404 HTML
// page and Safari rejected its parse with that generic message (Chromium words the
// same failure "Unexpected token '<'…", but Chromium never got to throw it: it was
// only ever run against the local harness, whose server root makes the bad path
// resolve). Root cause: ASSET_BASE was "../../assets/e1/" — the depth computed from
// THIS MODULE's folder (play/eras/) — but fetch() resolves relative URLs against the
// DOCUMENT base (play/), so on any host deeper than the server root (Hawk:
// /Hawk/games/gta-bakeoff/play/) the extra ".." escaped the game folder and the
// manifest URL landed on /Hawk/games/assets/e1/manifest.json (404). Locally the
// extra ".." clamped at the root and hit the real file, masking the bug in every
// harness run. Fixes: ASSET_BASE is now resolved from import.meta.url (immune to
// document depth); the manifest response is checked with resp.ok and a descriptive
// error (a future path slip reports "manifest HTTP 404 for <url>", not a parser
// riddle); and the manifest stage is split into manifest-fetch / manifest-parse /
// manifest-validate sub-stages, mirrored live into canvas.dataset.e1stage, so any
// remaining lurker narrows to a line from one screenshot.
//
// Build 2026-11-15-6 — ZOOM OUT. Owner verdict on build -5 (Nov 15, 20:31 ET):
// "way too zoomed in." The view scale drops from 21 to 12.5 px per metre (PPM
// below — the ONE view-scale constant): a 420 px-wide screen now shows ~33.6 m
// of city instead of ~20 m. Character height (CHARH) is derived from PPM so
// people shrink WITH the world instead of looming over it (a fixed 41 px figure
// at 12.5 px/m would read ~3.3 m tall). Nothing else changes: same sim, same
// demo route, same asset loading; HUD chrome keeps its fixed screen size.
//
// Until the asset pack loads (or if it fails), a flat zone-colour fallback keeps the page
// playable — see ARCHITECTURE.md ("a renderer draws its own placeholder rather than failing").
const PPM = 12.5, TILE = 64;                     // PPM = screen px per metre — THE view scale; TILE = px per tile in the baked ground
const GPX = TILE / 4, S = PPM / GPX;             // source-art px per metre (16); native->screen scale
const TS = TILE * S;                             // one tile on screen: 50 px
const CHARH = Math.round(PPM * 41 / 21);         // character figure height on screen, px — tracks PPM (41 px at the old 21 px/m framing)
const KPED = CHARH / 15, KLINK = CHARH / 16;     // frame scales: a ped figure fills 15 of its 24px frame; Link's fills 16 of 20
const ASSET_BASE = new URL("../../assets/e1/", import.meta.url).href;   // resolved from THIS module's URL (play/eras/), never the document's — see the build -5 note in the header
const BUILD = "2026-11-15-6";   // version stamp: keep in sync with play/index.html + play/eras/index.js (?v= on every import/fetch)
const PLAN = typeof location !== "undefined" && new URLSearchParams(location.search).has("plan");
const SHADOW_LIDS = new Set([97, 100, 127, 128, 129]);   // flat lids baked under the sprites
const PALM_LIDS = new Set([21, 126]);                    // flat lids baked into the overhead layer
const ZONE_PAL = { r: "#526b63", s: "#c6bd8c", l: "#7c7c88", g: "#425a00", d: "#f0d8a8", p: "#29a59c", m: "#de949c", b: "#efa542", o: "#39dede", "~": "#39dede", c: "#88889a", B: "#638c94" };
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});
const headIdx = (h, n) => ((Math.round(h / (2 * Math.PI) * n) % n) + n) % n;

// nearest-neighbour rotation strip for a sprite that has no pre-baked one (no blur, ever)
function rotations(src, n, S) {
  const w = src.width, h = src.height, sg = src.getContext("2d");
  if (!sg) return Array.from({ length: n }, () => mk(S, S));   // context refused: blank frames, never a throw
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

export function create(canvas, level) {
  const ctx = canvas.getContext("2d");
  canvas.dataset.e1build = BUILD;   // stamped synchronously: a screenshot proves which build ran
  const LW = level.w * TILE, LH = level.h * TILE;
  let ready = false, M = null, IMG = {}, under = null, decals = [], parked = [], pedDefs = [];
  let cam = null;

  // ---- fallback ground (zone colours at 16 px/cell), baked synchronously ----
  const fb = mk(level.w * 16, level.h * 16), fx = fb.getContext("2d");
  for (let ty = 0; ty < level.h; ty++) for (let tx = 0; tx < level.w; tx++) { fx.fillStyle = ZONE_PAL[level.ground[ty][tx]] || "#f0f"; fx.fillRect(tx * 16, ty * 16, 16, 16); }

  // ---- dressing peds: deterministic patrols on promenade / sidewalk cells ----
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

  // ---- asset loading + preparation (no offscreen level bake — see header) ----
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
    const setStage = s => { stage = s; canvas.dataset.e1stage = s; };
    setStage(stage);
    try {
      const resp = await fetch(ASSET_BASE + "manifest.json?v=" + BUILD);
      if (!resp.ok) throw new Error("manifest HTTP " + resp.status + " for " + ASSET_BASE + "manifest.json");
      setStage("manifest-parse");
      M = await resp.json();
      setStage("manifest-validate");
      if (!M || !M.files || !M.files.tiles || !M.tiles || !M.sprites || !M.viceBeachPlacements)
        throw new Error("manifest parsed but files/tiles/sprites/placements are missing");
      setStage("images");
      const F = M.files;
      await Promise.all([loadAsset("tiles", F.tiles), loadAsset("sprites", F.sprites),
        loadAsset("peds", F.peds), loadAsset("link", F.link), loadAsset("hud", F.hudFont)]);
      if (failedAssets.length) canvas.dataset.e1fail = failedAssets.join(",");
      if (!IMG.tiles) throw new Error("tiles sheet failed to load");
      setStage("prepare");
      prepare(); ready = true; canvas.dataset.e1 = "ready"; setStage("ready");
    } catch (e) {
      canvas.dataset.e1 = "fallback";
      const msg = e && e.message ? e.message : String(e);
      const top = e && e.stack ? (e.stack.split("\n")[1] || "").trim() : "";
      canvas.dataset.e1err = (stage + ": " + msg + (top ? " @ " + top : "")).slice(0, 300);
    }
  }
  function prepare() {
    const cells = level.cells, H = level.h, W = level.w, flat = M.tiles.flatTransparentMap;
    const isFlat = (tx, ty) => !!flat[cells[ty][tx][3]];
    // multi-source BFS: nearest non-flat cell's lid = the ground under a flat overlay
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
    // ground decals: the one placement type whose sprite resolves to a real OBJECT sprite.
    // Positions stay in source-art px; the ground pass blits the visible ones per frame.
    decals = [];
    for (const o of M.viceBeachPlacements.objects) {
      if (o.type !== 66) continue;
      const it = M.sprites.items[M.viceBeachPlacements.objectInfos[66].spr];
      decals.push({ it, bx: o.localX * TILE - it.anchorX, by: o.localY * TILE - it.anchorY });
    }
    // parked cars from the real placements: model -> sprite -> pre-rotated strip (or bake our own)
    const byModel = {}, stripByIdx = {};
    for (const c of M.sprites.carModels) byModel[c.model] = c.spriteIndex;
    for (const [name, st] of Object.entries(M.sprites.rotatedCarStrips)) stripByIdx[st.absIndex] = st;
    parked = IMG.sprites ? M.viceBeachPlacements.cars.map(c => {
      const idx = byModel[c.type], k = headIdx(c.rotDeg * Math.PI / 180, 32);
      if (stripByIdx[idx]) { const st = stripByIdx[idx]; return { frames: st.frames, x: c.localX * level.tile_m, y: c.localY * level.tile_m, k }; }
      const it = M.sprites.items[idx], src = crop(IMG.sprites, it);
      return { baked: rotations(src, 32, 96), x: c.localX * level.tile_m, y: c.localY * level.tile_m, k };
    }) : [];
  }

  // ---- per-frame ground: only the visible tiles are drawn, straight from the tile
  // sheet (about 6x12 tiles). No full-level offscreen canvas exists anywhere, so no
  // canvas in this renderer exceeds 2048 px in a dimension or ~1.5M px in area.
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

  // Size the backing store for the device pixel ratio; all drawing below is in CSS px.
  function fitCanvas() {
    const cw = canvas.clientWidth || 420, ch = canvas.clientHeight || 860;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [cw, ch];
  }

  // ---- HUD text in the era's own glyph sheet ----
  function drawText(text, x, y, scale, align = "left") {
    const gw = M.hudFont.cellW * scale, gh = M.hudFont.cellH * scale;
    let dx = align === "center" ? x - text.length * gw / 2 : align === "right" ? x - text.length * gw : x;
    for (const ch of text) {
      const g = M.hudFont.glyphs[ch];
      if (g) ctx.drawImage(IMG.hud, g.x, g.y, g.w, g.h, Math.round(dx), Math.round(y), gw, gh);
      dx += gw;
    }
  }
  // ---- on-screen diagnostics (fallback path only): the build tag + the real load
  // error, printed on the frame itself. A phone screenshot discriminates: no box at
  // all = cached pre-diagnostic code; box with an error = that error is the throw;
  // textured game = the load path worked.
  function drawDiag(W, H) {
    const err = canvas.dataset.e1err || "", fail = canvas.dataset.e1fail || "";
    const lines = [`e1 build ${BUILD} — ${err ? "FALLBACK" : "loading"}`];
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
    if (!ready) { ctx.fillStyle = "#888"; ctx.font = "16px monospace"; ctx.fillText("loading... e1 build " + BUILD, 16, 32); return; }
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
    name: "GTA 1 (1997)",
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
        // fallback canvas is 4 px per metre; the camera is in screen px (PPM per metre)
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(fb, camX / PPM * 4, camY / PPM * 4, W / PPM * 4, H / PPM * 4, 0, 0, W, H);
        ctx.fillStyle = "#18b8a8"; ctx.fillRect(Math.round(sim.car.x * PPM) - camX - 20, Math.round(sim.car.y * PPM) - camY - 28, 40, 56);
        if (sim.mode === "foot") { ctx.fillStyle = "#10ad42"; ctx.fillRect(Math.round(sim.hero.x * PPM) - camX - 8, Math.round(sim.hero.y * PPM) - camY - 8, 16, 16); }
        drawDiag(W, H);
        return;
      }
      // ground + canopy are drawn filtered (smoothing on): the same art The Original
      // presents through WebGL filtering. Sprites below stay nearest-neighbour crisp.
      ctx.imageSmoothingEnabled = true;
      drawGround(camX, camY, W, H);
      const f = level.route.finish;                                       // blinking finish marker
      if ((sim.tick >> 4) & 1) { ctx.fillStyle = "#f8f840"; const fs = Math.max(6, Math.round(8 * S)); ctx.fillRect(Math.round(f.x * level.tile_m * PPM) - fs / 2 - camX, Math.round(f.y * level.tile_m * PPM) - fs / 2 - camY, fs, fs); }
      ctx.imageSmoothingEnabled = false;
      if (IMG.sprites) for (const c of parked) {
        if (c.frames) { const fr = c.frames[c.k]; ctx.drawImage(IMG.sprites, fr.x, fr.y, fr.w, fr.h, Math.round(c.x * PPM - fr.anchorX * S) - camX, Math.round(c.y * PPM - fr.anchorY * S) - camY, fr.w * S, fr.h * S); }
        else { const im = c.baked[c.k]; ctx.drawImage(im, Math.round(c.x * PPM) - camX - im.width * S / 2, Math.round(c.y * PPM) - camY - im.height * S / 2, im.width * S, im.height * S); }
      }
      // dressing peds (visual only; positions are a pure function of sim.tick, so era switches stay deterministic)
      const variants = Object.values(M.peds.variants);
      if (IMG.peds) for (const pd of pedDefs) {
        const v = 1.15, L = pd.rangeM, dist = sim.tick / 60 * v + pd.off, u = dist % (2 * L), along = u < L ? u : 2 * L - u, fwd = u < L;
        const wx = pd.x + (pd.vert ? 0 : along - L / 2), wy = pd.y + (pd.vert ? along - L / 2 : 0);
        const dir = pd.vert ? (fwd ? "down" : "up") : (fwd ? "right" : "left");
        const fr = variants[pd.vi % variants.length].directions[dir][Math.floor(dist / 0.8) % 4];
        blit(IMG.peds, fr, wx, wy, KPED);
      }
      // the player's car: sport_red pre-rotated strip, k=0 is north, clockwise
      if (IMG.sprites) {
        const strip = M.sprites.rotatedCarStrips.sport_red, fr = strip.frames[headIdx(sim.car.h, 32)];
        ctx.drawImage(IMG.sprites, fr.x, fr.y, fr.w, fr.h, Math.round(sim.car.x * PPM - fr.anchorX * S) - camX, Math.round(sim.car.y * PPM - fr.anchorY * S) - camY, fr.w * S, fr.h * S);
      }
      // Link (Link's Awakening): direction by dominant axis, walk frame from ground covered (sim phase)
      if (sim.mode === "foot" && IMG.link) {
        const h = sim.hero.h, dir = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h)) ? (Math.sin(h) > 0 ? "right" : "left") : (Math.cos(h) > 0 ? "up" : "down");
        const fr2 = M.link.directions[dir][sim.hero.speed > .05 ? Math.floor(sim.hero.phase * 4) % 4 : 0];
        blit(IMG.link, fr2, sim.hero.x, sim.hero.y, KLINK);
      }
      ctx.imageSmoothingEnabled = true;
      drawCanopy(camX, camY, W, H);
      if (IMG.hud) drawHUD(sim, W, H);
    },
    dispose() {},
  };
}
