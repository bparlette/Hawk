// world3d.js — the SHARED 3D ENGINE for the 3D eras (e3–e8) of the Vice Beach bake-off.
//
// One engine, era = config. This module turns the canonical level
// (level/canonical/vice_beach.json via engine/level_vice.js) into a three.js scene
// ONCE — ground, buildings, water, palms, placement props, parked cars — and then
// renders the shared sim (engine/sim.js) into it: the hero (era Link), the player's
// car, dressing peds, the era camera at the LOCKED framing, fog measured from the
// PLAYER's ground point, and the era car-entry sequencer (wrapInput — SUPERSEDED by the
// sim's own timed entry, merge 2026-11-16; see the note at the export and play/index.html).
//
// An era module (play/eras/e<N>.js) is only:
//   import { createWorld3D } from "../engine/world3d.js";
//   export function create(canvas, level) {
//     return createWorld3D(canvas, level, { era: "e4", assetBase: new URL("../../assets/e4/", import.meta.url).href, ... });
//   }
// plus its in-canvas HUD skin on a 2D overlay (see eras/e3.js for the pattern).
//
// ERA CONFIG CONTRACT (see engine/README-ERA-CONTRACT.md for the full version):
//   era          "e3" — used for dataset stamps and the audio pack id.
//   assetBase    absolute URL of assets/<era>/ resolved from the ERA MODULE's
//                import.meta.url (NEVER a document-relative path — the e1 saga).
//   build        version stamp string, appended to every fetch as ?v=.
//   camera       { pitchDeg, fovDeg, distanceM } chosen so groundWidthM = 33.6
//                (the locked framing: 2 * distanceM * tan(fov/2) * aspect = 33.6
//                at the 420x860 stage aspect). pullBack = speed pull-back 0..0.2.
//   fog          { color, nearFromPlayerM, farFromPlayerM } — fog distances are
//                measured FROM THE PLAYER'S GROUND POINT (the Opus rule): every
//                frame, scene.fog.near/far = cameraDistanceToPlayer + these.
//   sky          clear/horizon colour (scene background = fog colour by default).
//   renderScale  internal render resolution as a fraction of CSS px (e3: 240/420
//                ≈ 0.571, upscaled nearest-neighbour by the page's pixelated CSS).
//   palette      { facade: [hex...], water, trunk, bush: [hex...], bench, pole }
//   heroCarStrip key into manifest.sprites.rotatedCarStrips (its frame 0 = the
//                north top view used as the car-body texture).
//   entry        { style: "runaround", doorSec } — the entry sequencer: on `act`
//                near the car the hero WALKS AROUND THE FRONT BUMPER to the driver
//                door (GTA III: no hood slide, ~2.5 s from the passenger side),
//                the door swings, then the sim's own enter fires. One sequencer
//                for thumbs and for The Run's autopilot alike.
//   lighting     { hemiSky, hemiGround, hemiIntensity, sunColor, sunIntensity }
//   wash         { file, strength } — full-screen grade from the pack's lighting/
//                sheet, applied as a multiply-blend overlay div (or null).
//   lampGlow     0..1 strength for placement lamp glows (0 = off).
//
// Renderer contract (ARCHITECTURE.md): create(canvas, level) -> { draw(sim),
// dispose(), wrapInput?(inp, sim) }. The renderer NEVER moves a street, never
// reinterprets sim position/heading/speed; visual-only motion (body roll, camera
// smoothing, door swing) is layered on top. Layout comes from `level` only:
// ground/buildings from level.cells, props and parked cars from
// level.placements (C1). Parked-car COLLISION is the sim's job (C2, engine/sim.js).
import * as THREE from "../vendor/three.module.min.js";
import { TUNE } from "./sim.js";

export const WORLD3D_BUILD = "2026-11-16-1";
const PLAN = typeof location !== "undefined" && new URLSearchParams(location.search).has("plan");
const SHADOW_LIDS = new Set([97, 100, 127, 128, 129]);   // flat lids drawn as ground overlays (shared with e1)
const PALM_LIDS = new Set([21, 126]);

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});

// ---- geometry bucket: accumulates textured or vertex-coloured quads/boxes and
// bakes them into ONE BufferGeometry per material (the whole static world is a
// handful of draw calls). Corners are always passed as [NW, NE, SE, SW] in world
// space (x east, z south, y up); UVs in the same corner order.
class Bucket {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, u, v, c) { this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v); this.col.push(c[0], c[1], c[2]); return this.n++; }
  quad(corners, normal, uvs, color) {
    const [a, b, c, d] = corners, [ua, ub, uc, ud] = uvs;
    const i0 = this.vert(...a, ...normal, ...ua, color), i1 = this.vert(...b, ...normal, ...ub, color);
    const i2 = this.vert(...c, ...normal, ...uc, color), i3 = this.vert(...d, ...normal, ...ud, color);
    this.idx.push(i0, i3, i2, i0, i2, i1);
  }
  // axis-aligned box centred at (cx, cz), base y0, size (w, h, d); top gets topUV
  // (or null for a plain colour top), sides/top coloured.
  box(cx, y0, cz, w, h, d, sideColor, topColor, topUV) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, Z = [0, 0];
    this.quad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], topUV || [Z, Z, Z, Z], topColor || sideColor);
    this.quad([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [1, 0, 0], [Z, Z, Z, Z], sideColor);   // east
    this.quad([[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]], [-1, 0, 0], [Z, Z, Z, Z], sideColor);  // west
    this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], [Z, Z, Z, Z], sideColor);  // north
    this.quad([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], [0, 0, 1], [Z, Z, Z, Z], sideColor);   // south
  }
  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    const mesh = new THREE.Mesh(g, material);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}
const C = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const WHITE = [1, 1, 1];
// rotate a [NW,NE,SE,SW] uv set by k quarter-turns clockwise (GTA 1 lidrot)
function rotUV(uvs, k) { let r = uvs; for (let i = 0; i < (k & 3); i++) r = [r[3], r[0], r[1], r[2]]; return r; }

export function createWorld3D(canvas, level, cfg) {
  const BUILD = cfg.build || WORLD3D_BUILD;
  canvas.dataset.state = "loading";
  const setStage = s => { canvas.dataset.w3dstage = s; };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const T = level.tile_m, W = level.w, H = level.h;
  const worldW = W * T, worldD = H * T;

  let M = null, ready = false, failed = false;
  const tex = {};            // THREE textures by pack role
  const dyn = { peds: [], lamps: [] };
  let heroCar = null, heroMesh = null, heroShadow = null, camTarget = null, camPos = null;
  let lastNow = performance.now(), brakeFlare = 0, doorFx = 0, waterTex = null;
  const entry = { active: null, prevAct: false, phase01: 0 };
  const debug = { entryState: "idle", fogNear: 0, fogFar: 0, camDist: 0, groundWidthM: 0 };

  // ---------- fallback world (zone colours; playable if the pack fails) ----------
  function buildFallback() {
    const cv = document.createElement("canvas"); cv.width = W * 4; cv.height = H * 4;
    const x = cv.getContext("2d");
    const ZC = { o: "#39dede", "~": "#39dede", p: "#29a59c", B: "#638c94", b: "#efa542", g: "#425a00", m: "#de949c", s: "#c6bd8c", r: "#526b63" };
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) { x.fillStyle = ZC[level.ground[ty][tx]] || "#f0f"; x.fillRect(tx * 4, ty * 4, 4, 4); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldD), new THREE.MeshBasicMaterial({ map: t }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.set(worldW / 2, 0, worldD / 2); scene.add(gnd);
    const boxG = new THREE.BoxGeometry(1, 1, 1);
    const mkBox = (w, h, d, color) => { const m = new THREE.Mesh(boxG, new THREE.MeshBasicMaterial({ color })); m.scale.set(w, h, d); return m; };
    heroCar = new THREE.Group(); const cb = mkBox(2, 1, 4.2, 0x18b8a8); cb.position.y = 0.5; heroCar.add(cb); scene.add(heroCar);
    heroMesh = mkBox(0.9, 1.7, 0.9, 0x10ad42); heroMesh.position.y = 0.85; scene.add(heroMesh);
    dyn.fallback = true;
  }

  // ---------- pack loading ----------
  async function load() {
    setStage("manifest-fetch");
    try {
      const resp = await fetch(cfg.assetBase + "manifest.json?v=" + BUILD);
      if (!resp.ok) throw new Error("manifest HTTP " + resp.status + " for " + cfg.assetBase + "manifest.json");
      setStage("manifest-parse");
      M = await resp.json();
      setStage("manifest-validate");
      if (!M || !M.files || !M.tiles || !M.sprites || !M.link || !M.peds) throw new Error("manifest parsed but files/tiles/sprites/link/peds are missing");
      setStage("images");
      const F = M.files, failedAssets = [];
      const get = async (key, file, srgb = true) => {
        try {
          const img = await loadImg(cfg.assetBase + file + "?v=" + BUILD);
          const t = new THREE.Texture(img); t.needsUpdate = true;
          t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          tex[key] = t;
        } catch { tex[key] = null; failedAssets.push(key); }
      };
      await Promise.all([get("tiles", F.tiles), get("sprites", F.sprites), get("peds", F.peds), get("link", F.link),
        get("blob", F["lighting.blobShadow"]), get("lampGlow", F["lighting.lampGlow"])]);
      if (failedAssets.length) canvas.dataset.w3dfail = failedAssets.join(",");
      if (!tex.tiles || !tex.sprites) throw new Error("tiles/sprites sheet failed to load");
      setStage("build");
      buildWorld();
      ready = true; canvas.dataset.state = "ready"; setStage("ready");
    } catch (e) {
      failed = true; canvas.dataset.state = "fallback";
      canvas.dataset.w3derr = ((canvas.dataset.w3dstage || "?") + ": " + (e && e.message ? e.message : String(e))).slice(0, 300);
      buildFallback();
    }
  }

  // ---------- world construction (static, merged) ----------
  function buildWorld() {
    const cells = level.cells, flat = M.tiles.flatTransparentMap || {};
    const tilesW = M.tiles.width, tilesH = M.tiles.height;
    const uvOf = (x, y, w, h) => [[x / tilesW, 1 - y / tilesH], [(x + w) / tilesW, 1 - y / tilesH], [(x + w) / tilesW, 1 - (y + h) / tilesH], [x / tilesW, 1 - (y + h) / tilesH]]; // [NW,NE,SE,SW]
    const lidUV = lid => { const e = M.tiles.lids[lid]; return e ? uvOf(e.x, e.y, e.w, e.h) : null; };
    const slotUV = slot => uvOf((slot % M.tiles.cols) * M.tiles.tileW, Math.floor(slot / M.tiles.cols) * M.tiles.tileH, M.tiles.tileW, M.tiles.tileH);

    // ground under flat overlays: nearest non-flat cell's lid (multi-source BFS, as e1)
    const isFlat = (tx, ty) => !!flat[cells[ty][tx][3]];
    const under = new Int32Array(W * H).fill(-1), q = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!isFlat(tx, ty)) { under[ty * W + tx] = cells[ty][tx][3]; q.push(tx, ty); }
    for (let i = 0; i < q.length; i += 2) {
      const tx = q[i], ty = q[i + 1];
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || under[ny * W + nx] >= 0) continue;
        under[ny * W + nx] = under[ty * W + tx]; q.push(nx, ny);
      }
    }

    // ERAS e3: "unlit textures + vertex-colour shading" — Basic materials, with
    // face shading baked into the vertex colours below (three r160's physical
    // light model would divide Lambert diffuse by PI and drown the pack art).
    const matTiles = new THREE.MeshBasicMaterial({ map: tex.tiles, vertexColors: true });
    const matAlpha = new THREE.MeshBasicMaterial({ map: tex.tiles, vertexColors: true, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    const matColor = new THREE.MeshBasicMaterial({ vertexColors: true });
    const ground = new Bucket(), roofs = new Bucket(), sides = new Bucket(), overlay = new Bucket(), canopy = new Bucket(), props = new Bucket();
    const isWater = z => z === "O" || z === "B" || z === "P";
    const cellCorners = (tx, ty, y) => [[tx * T, y, ty * T], [(tx + 1) * T, y, ty * T], [(tx + 1) * T, y, (ty + 1) * T], [tx * T, y, (ty + 1) * T]];

    // water texture: the first ocean cell's lid, extracted to a repeatable canvas
    let waterLid = 0;
    outer: for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (cells[ty][tx][0] === "O") { waterLid = cells[ty][tx][3]; break outer; }
    const wcv = document.createElement("canvas"); wcv.width = wcv.height = 64;
    if (tex.tiles && waterLid) { const e = M.tiles.lids[waterLid]; wcv.getContext("2d").drawImage(tex.tiles.image, e.x, e.y, 64, 64, 0, 0, 64, 64); }
    waterTex = new THREE.CanvasTexture(wcv); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
    waterTex.magFilter = THREE.NearestFilter; waterTex.minFilter = THREE.NearestFilter; waterTex.generateMipmaps = false;
    waterTex.colorSpace = THREE.SRGBColorSpace;
    const water = new Bucket();

    const facade = (cfg.palette && cfg.palette.facade || ["#6a7076"]).map(C);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const cell = cells[ty][tx], zone = cell[0], z = cell[2], lid = cell[3], rot = cell[4], f = flat[lid];
      const jitter = 0.96 + hash2(tx, ty) * 0.08, jc = [jitter, jitter, jitter];
      if (isWater(zone)) { // water surface, slightly below grade, scrolling texture
        const c = cellCorners(tx, ty, -0.18), s = T / 4;
        water.quad(c, [0, 1, 0], [[tx * s, ty * s], [(tx + 1) * s, ty * s], [(tx + 1) * s, (ty + 1) * s], [tx * s, (ty + 1) * s]], WHITE);
        continue;
      }
      if (zone === "H" && z <= 3) { // a real building: roof at (4-z)*4 m, coloured sides
        const hgt = (4 - z) * 4, fc = facade[Math.floor(hash2(tx >> 1, ty >> 1) * facade.length)];
        roofs.quad(cellCorners(tx, ty, hgt), [0, 1, 0], rotUV(lidUV(lid) || slotUV(0), rot), jc);
        const nb = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 99 : (cells[y][x][0] === "H" ? (4 - cells[y][x][2]) * 4 : 0);
        const x0 = tx * T, x1 = (tx + 1) * T, z0 = ty * T, z1 = (ty + 1) * T, Z = [0, 0], zuv = [Z, Z, Z, Z];
        const shd = k => [fc[0] * k, fc[1] * k, fc[2] * k];
        if (nb(tx + 1, ty) < hgt) sides.quad([[x1, 0, z0], [x1, 0, z1], [x1, hgt, z1], [x1, hgt, z0]], [1, 0, 0], zuv, shd(0.85));
        if (nb(tx - 1, ty) < hgt) sides.quad([[x0, 0, z1], [x0, 0, z0], [x0, hgt, z0], [x0, hgt, z1]], [-1, 0, 0], zuv, shd(0.78));
        if (nb(tx, ty - 1) < hgt) sides.quad([[x0, 0, z0], [x1, 0, z0], [x1, hgt, z0], [x0, hgt, z0]], [0, 0, -1], zuv, shd(0.68));
        if (nb(tx, ty + 1) < hgt) sides.quad([[x1, 0, z1], [x0, 0, z1], [x0, hgt, z1], [x1, hgt, z1]], [0, 0, 1], zuv, shd(0.95));
        continue;
      }
      // grade surface (incl. zero-height building footprints at z 4-5)
      if (f) {
        ground.quad(cellCorners(tx, ty, 0), [0, 1, 0], lidUV(under[ty * W + tx]) || slotUV(0), jc);
        if (!PALM_LIDS.has(lid)) overlay.quad(cellCorners(tx, ty, 0.03), [0, 1, 0], rotUV(slotUV(f.transparentSlot), rot), WHITE);
      } else ground.quad(cellCorners(tx, ty, 0), [0, 1, 0], rotUV(lidUV(lid) || slotUV(0), rot), jc);
    }
    scene.add(ground.build(matTiles), roofs.build(matTiles), sides.build(matColor), overlay.build(matAlpha));
    const waterMesh = water.build(new THREE.MeshBasicMaterial({ map: waterTex, vertexColors: true }));
    scene.add(waterMesh); dyn.waterMesh = waterMesh;

    // palms: trunk prism + crossed canopy quads textured with the palm lid
    const palmEntry = flat[21] || flat[126];
    if (palmEntry) {
      const canopyUV = slotUV(palmEntry.transparentSlot), trunkC = C(cfg.palette && cfg.palette.trunk || "#5a4632");
      const trunks = new Bucket();
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
        const cell = cells[ty][tx];
        if (cell[7] !== 1 && !PALM_LIDS.has(cell[3])) continue;
        const cx = (tx + 0.5) * T, cz = (ty + 0.5) * T, r = 0.14, top = 3.6;
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          const a0 = sIdx / 5 * Math.PI * 2, a1 = (sIdx + 1) / 5 * Math.PI * 2;
          const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
          const n = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)], Z = [0, 0];
          trunks.quad([[p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], top, p1[1]], [p0[0], top, p0[1]]], n, [Z, Z, Z, Z], trunkC);
        }
        const s = 2.7, y = top + 0.35;
        canopy.quad([[cx - s, y, cz - s], [cx + s, y, cz - s], [cx + s, y, cz + s], [cx - s, y, cz + s]], [0, 1, 0], canopyUV, WHITE);
        canopy.quad([[cx - s, y + 0.5, cz - s], [cx + s, y + 0.5, cz - s], [cx + s, y + 0.5, cz + s], [cx - s, y + 0.5, cz + s]], [0, 1, 0], rotUV(canopyUV, 1), WHITE);
      }
      scene.add(trunks.build(matColor), canopy.build(matAlpha));
    }

    buildProps(props, matColor, overlay);
    scene.add(props.build(matColor));

    // lights + fog + sky
    const L = cfg.lighting || {};
    scene.add(new THREE.HemisphereLight(new THREE.Color(L.hemiSky || "#b8c4cc"), new THREE.Color(L.hemiGround || "#4a4a48"), L.hemiIntensity != null ? L.hemiIntensity : 1.05));
    const sun = new THREE.DirectionalLight(new THREE.Color(L.sunColor || "#d8dde2"), L.sunIntensity != null ? L.sunIntensity : 0.5);
    sun.position.set(-40, 80, -30); scene.add(sun);
    scene.fog = new THREE.Fog(new THREE.Color(cfg.fog.color), 60, 150);
    scene.background = new THREE.Color(cfg.sky || cfg.fog.color);

    // dynamic actors
    buildCarsAndHero();
    buildPeds();
    if (cfg.wash && tex.blob) { /* wash handled below via overlay div using the pack file directly */ }
    if (cfg.wash) {
      const div = document.createElement("div");
      div.style.cssText = "position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;background-size:100% 100%;opacity:" + (cfg.wash.strength != null ? cfg.wash.strength : 0.68);
      div.style.backgroundImage = `url("${cfg.assetBase}${cfg.wash.file}?v=${BUILD}")`;
      canvas.parentElement.insertBefore(div, canvas.nextSibling); dyn.washDiv = div;   // directly above the game canvas, below the page's chips/button
    }
  }

  // ---------- placement props (C1: positions from the level; none are solid) ----------
  function buildProps(props, matColor, overlay) {
    const P = level.placements || { objects: [], cars: [] };
    const bush = (cfg.palette && cfg.palette.bush || ["#3f6126"]).map(C);
    const benchC = C(cfg.palette && cfg.palette.bench || "#6b5a49"), poleC = C(cfg.palette && cfg.palette.pole || "#3c4148");
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const icoPos = ico.getAttribute("position"), icoNor = ico.getAttribute("normal");
    const blobAt = (cx, cz, r, sy, color) => { // squashed icosahedron merged into the props bucket
      const m = new THREE.Matrix4().makeScale(r, r * sy, r).setPosition(cx, r * sy * 0.75, cz);
      const v = new THREE.Vector3();
      for (let i = 0; i < icoPos.count; i += 3) {
        const idxs = [];
        for (let k = 0; k < 3; k++) { v.fromBufferAttribute(icoPos, i + k).applyMatrix4(m); const nrm = new THREE.Vector3().fromBufferAttribute(icoNor, i + k); idxs.push(props.vert(v.x, v.y, v.z, nrm.x, nrm.y, nrm.z, 0, 0, color)); }
        props.idx.push(idxs[0], idxs[1], idxs[2]);
      }
    };
    for (const o of P.objects) {
      const x = o.x * T, z = o.y * T;
      if (o.type === 66) { // the one type whose OBJECT sprite resolves: a ground decal
        const it = M.sprites.items[258];
        if (it && tex.sprites) {
          const sw = M.sprites.width, sh = M.sprites.height, w = it.w / 16, d = it.h / 16;
          const uv = [[it.x / sw, 1 - it.y / sh], [(it.x + it.w) / sw, 1 - it.y / sh], [(it.x + it.w) / sw, 1 - (it.y + it.h) / sh], [it.x / sw, 1 - (it.y + it.h) / sh]];
          const cs = Math.cos(o.rot), sn = Math.sin(o.rot), cor = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
            .map(([lx, lz]) => [x + lx * cs - lz * sn, 0.04, z + lx * sn + lz * cs]);
          overlay.quad(cor, [0, 1, 0], uv, WHITE);
        }
      } else if (o.type === 8) { // promenade lamp line (perfect N-S row on the promenade)
        props.box(x, 0, z, 0.14, 4.6, 0.14, poleC, poleC, null);
        props.box(x, 4.6, z, 0.5, 0.22, 0.5, poleC, poleC, null);
        if (tex.lampGlow && (cfg.lampGlow == null || cfg.lampGlow > 0)) {
          const sm = new THREE.SpriteMaterial({ map: tex.lampGlow, transparent: true, opacity: (cfg.lampGlow != null ? cfg.lampGlow : 0.55), depthWrite: false });
          const sp = new THREE.Sprite(sm); sp.position.set(x, 4.6, z); sp.scale.set(2.6, 2.6, 1); scene.add(sp); dyn.lamps.push(sp);
        }
      } else if (o.type === 2) { // promenade furniture: a low bench
        props.box(x, 0.12, z, 1.9, 0.42, 0.55, benchC, benchC, null);
      } else if (o.type === 16) { // wide flat fixture on the sidewalk
        props.box(x, 0, z, 2.4, 0.8, 1.2, poleC, poleC, null);
      } else { // grass/sand scatter (types 5, 68, 71, 86, 87): bush/rock blobs
        blobAt(x, z, 0.55 + hash2(o.x * 10 | 0, o.y * 10 | 0) * 0.5, 0.62, bush[Math.floor(hash2(o.x | 0, o.y | 0) * bush.length)]);
      }
    }
  }

  // ---------- cars & hero ----------
  function carTexture(item) {
    const t = tex.sprites.clone(); t.needsUpdate = true;
    t.repeat.set(item.w / M.sprites.width, item.h / M.sprites.height);
    t.offset.set(item.x / M.sprites.width, 1 - (item.y + item.h) / M.sprites.height);
    return t;
  }
  function makeCar(model, withDoor) {
    const cm = (M.sprites.carModels || []).find(c => c.model === model);
    const item = M.sprites.items[cm ? cm.spriteIndex : 56];
    const w = item.w / 16, l = item.h / 16;                    // pack art at 16 px per metre
    const sw = M.sprites.width, sh = M.sprites.height;
    const uv = [[item.x / sw, 1 - item.y / sh], [(item.x + item.w) / sw, 1 - item.y / sh], [(item.x + item.w) / sw, 1 - (item.y + item.h) / sh], [item.x / sw, 1 - (item.y + item.h) / sh]];
    const crop = [[(item.x + item.w * 0.2) / sw, 1 - (item.y + item.h * 0.3) / sh], [(item.x + item.w * 0.8) / sw, 1 - (item.y + item.h * 0.3) / sh], [(item.x + item.w * 0.8) / sw, 1 - (item.y + item.h * 0.7) / sh], [(item.x + item.w * 0.2) / sw, 1 - (item.y + item.h * 0.7) / sh]];
    const sideC = C(["#4c525a", "#5d646d", "#3c4148", "#6a7076"][Math.abs(model) % 4]), dark = C("#14181c");
    const b = new Bucket();
    b.box(0, 0.15, 0, w, 0.6, l, sideC, WHITE, uv);                        // body, textured top
    b.box(0, 0.75, l * 0.03, w * 0.82, 0.5, l * 0.48, dark, WHITE, crop);  // cabin, centre-crop top
    for (const [wx, wz] of [[-w / 2, -l * 0.32], [w / 2, -l * 0.32], [-w / 2, l * 0.32], [w / 2, l * 0.32]])
      b.box(wx, 0.02, wz, 0.16, 0.42, 0.62, dark, dark, null);            // wheels
    const mat = new THREE.MeshBasicMaterial({ map: tex.sprites, vertexColors: true });
    const mesh = b.build(mat); mesh.matrixAutoUpdate = true;
    const grp = new THREE.Group(); grp.add(mesh);
    if (tex.blob) {
      const sh2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25, l * 1.12), new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.85 }));
      sh2.rotation.x = -Math.PI / 2; sh2.position.y = 0.02; sh2.renderOrder = 1; grp.add(sh2);
    }
    const out = { grp, w, l, doorPivot: null, brakes: [] };
    if (withDoor) {
      const pivot = new THREE.Group(); pivot.position.set(-w / 2, 0.72, -l * 0.14);
      const db = new Bucket(); db.box(0, -0.3, 0.55, 0.07, 0.52, 1.1, sideC, sideC, null);
      const dm = db.build(new THREE.MeshBasicMaterial({ vertexColors: true })); dm.matrixAutoUpdate = true;
      pivot.add(dm); grp.add(pivot); out.doorPivot = pivot;
      const bm = new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.25 });
      for (const s of [-1, 1]) {
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), bm);
        bl.position.set(s * w * 0.27, 0.48, l / 2 + 0.02); grp.add(bl); out.brakes.push(bl);
      }
    }
    return out;
  }
  function buildCarsAndHero() {
    // parked cars: placements from the level, models from the pack (C1)
    for (const c of (level.placements && level.placements.cars || [])) {
      const car = makeCar(c.model, false);
      car.grp.position.set(c.x * T, 0, c.y * T);
      car.grp.rotation.y = -c.rot;
      scene.add(car.grp);
    }
    // the player's car: the pack's hero strip (frame 0 = north top view)
    const strip = M.sprites.rotatedCarStrips[cfg.heroCarStrip];
    const heroModel = strip ? (M.sprites.carModels.find(c => c.spriteIndex === strip.absIndex) || {}).model : 70;
    heroCar = makeCar(heroModel != null ? heroModel : 70, true);
    scene.add(heroCar.grp);
    // Link: a feet-anchored billboard sampling the pack's direction sheet by
    // heading + sim phase (walk cycle from ground covered, per the contract).
    const lg = new THREE.PlaneGeometry(2.4, 2.4); lg.translate(0, 0.6, 0);   // frame 2.4 m: the figure fills 16/20 of it (~1.9 m, e1 parity)
    const lt = tex.link.clone(); lt.needsUpdate = true;
    heroMesh = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: lt, transparent: true, alphaTest: 0.4 }));
    scene.add(heroMesh);
    if (tex.blob) {
      heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: tex.blob, transparent: true, depthWrite: false, opacity: 0.8 }));
      heroShadow.rotation.x = -Math.PI / 2; heroShadow.renderOrder = 1; scene.add(heroShadow);
    }
    dyn.linkTex = lt;
  }

  // ---------- dressing peds: deterministic patrols, pure functions of sim.tick
  // (the e1 pattern — era switches stay deterministic, peds are visual only) ----
  function buildPeds() {
    const WALK_OK = new Set(["m", "s", "b", "g"]), bases = [];
    for (let ty = 2; ty < H - 2 && bases.length < 16; ty += 3)
      for (let tx = 0; tx < W; tx++) {
        const z = level.ground[ty][tx];
        if ((z === "m" || (z === "s" && tx > 30)) && (tx * 7 + ty * 13) % 5 === 0) bases.push({ tx, ty, vert: z === "m" });
      }
    const variants = Object.values(M.peds.variants);
    dyn.peds = bases.map((b, i) => {
      let range = 0; const step = b.vert ? [0, 1] : [1, 0];
      for (let d = 1; d <= 3; d++) {
        const a = level.ground[b.ty + step[1] * d] && level.ground[b.ty + step[1] * d][b.tx + step[0] * d];
        const c = level.ground[b.ty - step[1] * d] && level.ground[b.ty - step[1] * d][b.tx - step[0] * d];
        if (WALK_OK.has(a) && WALK_OK.has(c)) range = d; else break;
      }
      if (!range) return null;
      const g = new THREE.PlaneGeometry(2.6, 2.6); g.translate(0, 0.325, 0);   // figure fills 15/24 (~1.6 m)
      const t = tex.peds.clone(); t.needsUpdate = true;
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4 }));
      scene.add(mesh);
      return { x: (b.tx + .5) * T, y: (b.ty + .5) * T, vert: b.vert, rangeM: range * T, off: i * 3.7, variant: variants[i % variants.length], mesh, tex: t };
    }).filter(Boolean);
  }
  function sheetFrame(tex, sheet, fr) {
    tex.repeat.set(fr.w / sheet.width, fr.h / sheet.height);
    tex.offset.set(fr.x / sheet.width, 1 - (fr.y + fr.h) / sheet.height);
  }

  // ---------- car entry sequencer (GTA III: run-around, never a hood slide) ----
  function startEntry(sim) {
    const c = sim.car, h = sim.hero, TUNE_C = TUNE.car;
    const fwd = { x: Math.sin(c.h), y: -Math.cos(c.h) }, left = { x: -Math.cos(c.h), y: -Math.sin(c.h) };
    const carL = heroCar ? heroCar.l : 4, carW = heroCar ? heroCar.w : 3.2;
    const door = { x: c.x + left.x * (carW / 2 + 0.45) + fwd.x * 0.55, y: c.y + left.y * (carW / 2 + 0.45) + fwd.y * 0.55 };
    const rel = { x: h.x - c.x, y: h.y - c.y }, lat = rel.x * left.x + rel.y * left.y;
    const wps = [];
    if (lat <= 0.3) { // passenger side (or nose/tail): around the FRONT bumper, per the study
      const s = lat >= 0 ? 1 : -1;
      wps.push({ x: c.x + fwd.x * (carL / 2 + 0.9) + left.x * s * (carW / 2 + 0.6), y: c.y + fwd.y * (carL / 2 + 0.9) + left.y * s * (carW / 2 + 0.6) });
      wps.push({ x: c.x + fwd.x * (carL / 2 + 1.0), y: c.y + fwd.y * (carL / 2 + 1.0) });
    }
    wps.push(door);
    entry.active = { phase: "walk", wps, door, steps: 0 };
    entry.phase01 = 0;
    debug.entryState = "walk";
  }
  function wrapInput(inp, sim) {
    const rising = !!inp.act && !entry.prevAct;
    entry.prevAct = !!inp.act;
    if (!entry.active) {
      if (rising && sim.mode === "drive" && Math.abs(sim.car.v) <= TUNE.car.exitSpeed) doorFx = 1;  // exit: door visual only, input untouched
      if (rising && sim.mode === "foot" && ready &&
          Math.hypot(sim.hero.x - sim.car.x, sim.hero.y - sim.car.y) <= TUNE.car.enterDist) {
        startEntry(sim);
        return { mx: inp.mx, my: inp.my, act: false };   // swallow the trigger press: the sim's own instant enter must NOT fire — the sequencer pulses act itself at the door beat
      }
      return inp;
    }
    const E = entry.active; E.steps++;
    if (sim.mode !== "foot") { entry.active = null; debug.entryState = "idle"; return inp; }  // entered some other way: release
    if (E.phase === "walk") {
      const wp = E.wps[0], h = sim.hero;
      const dx = wp.x - h.x, dy = wp.y - h.y, d = Math.hypot(dx, dy);
      if (d < 0.32 || E.steps > 360) {
        E.wps.shift();
        if (!E.wps.length) { E.phase = "door"; E.steps = 0; debug.entryState = "door"; return { mx: 0, my: 0, act: false }; }
        return wrapInput(inp, sim);
      }
      return { mx: dx / d, my: dy / d, act: false };
    }
    // door phase: hero stands at the door; the door swings (draw reads phase01),
    // then ONE act pulse hands over to the sim's own enter at the study's beat.
    const total = Math.max(12, Math.round((cfg.entry && cfg.entry.doorSec || 1.15) * 60));
    entry.phase01 = clamp(E.steps / total, 0, 1);
    if (E.steps >= total) { entry.active = null; entry.phase01 = 0; brakeFlare = 1; debug.entryState = "idle"; return { mx: 0, my: 0, act: true }; }
    return { mx: 0, my: 0, act: false };
  }

  // ---------- camera & frame ----------
  const camera = new THREE.PerspectiveCamera(cfg.camera.fovDeg, 420 / 860, 0.5, 600);
  const planCam = new THREE.OrthographicCamera(-worldW / 2, worldW / 2, worldW / (2 * (420 / 860)), -worldW / (2 * (420 / 860)), 1, 700);
  let prevCarV = 0;
  function fit() {
    const cw = canvas.clientWidth || 420, ch = canvas.clientHeight || 860;
    const bw = Math.max(2, Math.round(cw * (cfg.renderScale || 1))), bh = Math.max(2, Math.round(ch * (cfg.renderScale || 1)));
    if (canvas.width !== bw || canvas.height !== bh) { renderer.setSize(bw, bh, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); }
    return [cw, ch];
  }
  function draw(sim) {
    fit();
    const now = performance.now(), dt = clamp((now - lastNow) / 1000, 0.001, 0.1); lastNow = now;
    if (PLAN) {
      planCam.position.set(worldW / 2, 300, worldD / 2); planCam.up.set(0, 0, -1); planCam.lookAt(worldW / 2, 0, worldD / 2);
      const f = scene.fog; scene.fog = null; renderer.render(scene, planCam); scene.fog = f; return;
    }
    const p = sim.player();
    if (waterTex && ready) { waterTex.offset.set((sim.tick * 0.0006) % 1, (sim.tick * 0.00035) % 1); }
    if (!ready) { // fallback: plain follow camera, actors as coloured boxes
      const D = 40;
      camera.position.set(p.x, D * 0.82, p.z != null ? p.z : p.y + D * 0.57);
      camera.position.set(p.x, D * 0.82, p.y + D * 0.57); camera.lookAt(p.x, 0, p.y);
      if (heroCar) { heroCar.position.set(sim.car.x, 0, sim.car.y); }
      if (heroMesh) { heroMesh.position.set(sim.hero.x, 0.85 + (sim.hero.z || 0), sim.hero.y); heroMesh.visible = sim.mode !== "drive"; }   // MERGE 2026-11-16: hero stays visible through the sim's enter/exit modes
      renderer.render(scene, camera); return;
    }
    // hero car: position/heading are the sim's; roll/pitch are visual only
    heroCar.grp.position.set(sim.car.x, 0, sim.car.y);
    heroCar.grp.rotation.y = -sim.car.h;
    const accel = (sim.car.v - prevCarV) / dt; prevCarV = sim.car.v;
    heroCar.grp.rotation.z = clamp(-sim.car.steer * Math.abs(sim.car.v) * 0.006, -0.05, 0.05);
    heroCar.grp.rotation.x = clamp(accel * 0.0016, -0.03, 0.03);
    brakeFlare = Math.max(0, brakeFlare - dt * 2.2); doorFx = Math.max(0, doorFx - dt * 1.6);
    const braking = sim.mode === "drive" && accel < -1.2;
    const bOp = braking || brakeFlare > 0 ? 0.95 : 0.25;
    for (const b of heroCar.brakes) b.material.opacity = bOp;
    // door swing: entry door phase, or the exit flourish
    let doorOpen = 0;
    if (entry.active && entry.active.phase === "door") doorOpen = Math.sin(Math.min(1, entry.phase01 * 1.15) * Math.PI * 0.62);
    else if (doorFx > 0) doorOpen = Math.sin(doorFx * Math.PI) * 0.9;
    else if ((sim.mode === "enter" || sim.mode === "exit") && sim.trans) doorOpen = Math.sin(clamp(sim.trans.t / sim.trans.dur, 0, 1) * Math.PI) * 0.9;   // MERGE 2026-11-16: door follows the SIM's timed entry/exit sequence
    if (heroCar.doorPivot) heroCar.doorPivot.rotation.y = -1.25 * doorOpen;
    // hero billboard
    const h = sim.hero;
    heroMesh.visible = sim.mode !== "drive";   // MERGE 2026-11-16: Lane A's sim adds "enter"/"exit" modes — the hero is on screen (and sim-positioned) through both; only "drive" hides him
    if (heroMesh.visible) {
      let hx = h.x, hz = h.y;
      if (entry.active && entry.active.phase === "door") { const k = entry.phase01 * entry.phase01; hx = lerp(h.x, entry.active.door.x, k * 0.85); hz = lerp(h.y, entry.active.door.y, k * 0.85); }
      heroMesh.position.set(hx, h.z || 0, hz);   // hero.z = 1 during the sim's hood slide: lift the billboard onto the car body
      heroMesh.rotation.y = Math.atan2(camera.position.x - hx, camera.position.z - hz);
      const hd = Math.abs(Math.sin(h.h)) > Math.abs(Math.cos(h.h)) ? (Math.sin(h.h) > 0 ? "right" : "left") : (Math.cos(h.h) > 0 ? "up" : "down");
      const dirs = M.link.directions[hd] || M.link.directions.down;
      const fr = dirs[h.speed > 0.05 ? Math.floor(h.phase * 4) % 4 : 0];
      sheetFrame(dyn.linkTex, M.link, fr);
      const lean = clamp(h.speed / (TUNE.foot.run || TUNE.foot.speed || 4.6), 0, 1) * 0.2;   // MERGE 2026-11-16: Lane A's TUNE.foot has no run split (one pace, `speed`) — dividing by undefined made lean NaN and the hero billboard vanished
      heroMesh.rotation.x = hd === "up" ? -lean : hd === "down" ? lean : 0;
      heroMesh.rotation.z = hd === "right" ? -lean : hd === "left" ? lean : 0;
      if (heroShadow) heroShadow.position.set(hx, 0.02, hz);
    }
    if (heroShadow) heroShadow.visible = heroMesh.visible;
    // peds
    for (const pd of dyn.peds) {
      const dist = sim.tick / 60 * 1.15 + pd.off, L = pd.rangeM, u = dist % (2 * L), along = u < L ? u : 2 * L - u, fwd = u < L;
      const wx = pd.x + (pd.vert ? 0 : along - L / 2), wz = pd.y + (pd.vert ? along - L / 2 : 0);
      pd.mesh.position.set(wx, 0, wz);
      pd.mesh.rotation.y = Math.atan2(camera.position.x - wx, camera.position.z - wz);
      const dir = pd.vert ? (fwd ? "down" : "up") : (fwd ? "right" : "left");
      const fr = pd.variant.directions[dir][Math.floor(dist / 0.8) % 4];
      sheetFrame(pd.tex, M.peds, fr);
    }
    // camera: locked framing (33.6 m across at the player's ground point),
    // gentle speed pull-back; the camera NEVER yaws (stick = world directions).
    const pitch = cfg.camera.pitchDeg * Math.PI / 180;
    const speedK = sim.mode === "drive" ? clamp(Math.abs(sim.car.v) / TUNE.car.vmax, 0, 1) : 0;
    const D = cfg.camera.distanceM * (1 + (cfg.camera.pullBack || 0) * speedK);
    const lead = sim.mode === "drive" ? sim.car.v * 0.32 : 0;
    const tx = p.x + Math.sin(p.h) * lead, tz = p.y - Math.cos(p.h) * lead;
    if (!camPos) { camPos = new THREE.Vector3(tx, D * Math.sin(pitch), tz + D * Math.cos(pitch)); camTarget = new THREE.Vector3(tx, 0, tz); }
    camTarget.x += (tx - camTarget.x) * (1 - Math.exp(-dt * 5)); camTarget.z += (tz - camTarget.z) * (1 - Math.exp(-dt * 5));
    const des = new THREE.Vector3(camTarget.x, D * Math.sin(pitch), camTarget.z + D * Math.cos(pitch));
    camPos.lerp(des, 1 - Math.exp(-dt * 4));
    camera.position.copy(camPos);
    camera.lookAt(camTarget.x, 0.6, camTarget.z);
    // fog measured from the PLAYER's ground point, not the camera (Opus rule)
    const camDist = camera.position.distanceTo(new THREE.Vector3(p.x, 0, p.y));
    scene.fog.near = camDist + cfg.fog.nearFromPlayerM;
    scene.fog.far = camDist + cfg.fog.farFromPlayerM;
    debug.camDist = camDist; debug.fogNear = scene.fog.near; debug.fogFar = scene.fog.far;
    debug.groundWidthM = 2 * camDist * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
    renderer.render(scene, camera);
  }

  load();
  return {
    name: cfg.name || cfg.era,
    draw,   // MERGE 2026-11-16: wrapInput (the renderer entry sequencer above) is intentionally NOT exported — Lane A's sim owns timed entry now; see play/index.html. The function is kept for reference only.
    debug,
    get entryState() { return debug.entryState; },
    dispose() {
      if (dyn.washDiv) dyn.washDiv.remove();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose();
    },
  };
}
