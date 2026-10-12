// Builds the lit 3D world from the flat 2D tile grid.
// Gameplay never reads anything in here: the grid is the single source of truth,
// and this file only turns it into chunky geometry.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rockNormalMap, rockColorMap, brickTexture, runeTextures, coinTexture, backdropTexture } from './textures.js';

export const TILE_Z_FRONT = 0.9, TILE_Z_BACK = -1.5;
const DEPTH = TILE_Z_FRONT - TILE_Z_BACK, ZMID = (TILE_Z_FRONT + TILE_Z_BACK) / 2;
export const CHUNK = 16;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function paint(geo, col) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
// per-vertex colour by face normal: top faces get an icy tint
function paintRock(geo, base, top, bottom) {
  const n = geo.attributes.position.count, nr = geo.attributes.normal, a = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const ny = nr.getY(i);
    c.copy(base); if (ny > 0.5 && top) c.lerp(top, Math.min(1, (ny - 0.5) * 2)); if (ny < -0.5 && bottom) c.lerp(bottom, 0.6);
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
// crystal prism: hexagonal shaft + pointed tip, colour brightening toward the tip
function crystalGeo(r, h, col, sides = 6) {
  const shaft = new THREE.CylinderGeometry(r * 0.82, r, h * 0.72, sides, 1); shaft.translate(0, h * 0.36, 0);
  const tip = new THREE.ConeGeometry(r * 0.82, h * 0.28, sides, 1); tip.translate(0, h * 0.72 + h * 0.14, 0);
  const g = mergeGeometries([shaft.toNonIndexed(), tip.toNonIndexed()]);
  const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color();
  for (let i = 0; i < n; i++) { const t = g.attributes.position.getY(i) / h; cc.copy(col).multiplyScalar(0.45 + t * 0.9); a.set([cc.r, cc.g, cc.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
const PALETTE = { mag: new THREE.Color('#ff3ccf'), vio: new THREE.Color('#9b46ff'), pink: new THREE.Color('#ff7be6'), cyan: new THREE.Color('#38e8ff') };

function cluster(out, x, y, z, scale, r, opts = {}) {
  const n = opts.n || 3 + (r() * 4 | 0), down = !!opts.down, cols = opts.cols || [PALETTE.mag, PALETTE.vio, PALETTE.pink];
  for (let i = 0; i < n; i++) {
    const h = scale * (0.5 + r() * 0.9) * (i === 0 ? 1.35 : 1), rad = scale * (0.12 + r() * 0.1);
    const g = crystalGeo(rad, h, cols[(r() * cols.length) | 0], r() < 0.5 ? 5 : 6);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const tilt = new THREE.Euler((r() - 0.5) * 0.9, r() * 6.28, (r() - 0.5) * 1.1 + (down ? Math.PI : 0));
    q.setFromEuler(tilt); m.compose(new THREE.Vector3(x + (r() - 0.5) * scale * 0.5, y, z + (r() - 0.5) * scale * 0.4), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m); out.push(g);
  }
}

export function buildWorld(scene, level) {
  const H = level.length, W = level[0].length;
  const at = (c, r) => (r < 0 || r >= H || c < 0 || c >= W) ? '#' : level[r][c];
  const isRock = (c, r) => at(c, r) === '#';
  const isSolid = (c, r) => '#CPB?'.includes(at(c, r));
  const wy = (r) => H - 1 - r;
  const R = rng(1234);
  const nrm = rockNormalMap(), alb = rockColorMap();
  const world = { chunks: [], blocks: [], coins: [], enemies: [], crystalSpots: [], start: null, goal: null, W, H };

  // ---------- rock tiles -> bevelled blocks merged per chunk ----------
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: alb, normalMap: nrm, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.82, metalness: 0.05 });
  const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.4, 3.2) }); // HDR cyan -> blooms
  const base = new RoundedBoxGeometry(1.04, 1.04, DEPTH, 1, 0.13);
  const rimGeos = [];
  const baseCol = new THREE.Color('#5d73a8'), deepCol = new THREE.Color('#34436e'), iceCol = new THREE.Color('#8ff0ff'), underCol = new THREE.Color('#1d2647');
  for (let cx = 0; cx < W; cx += CHUNK) {
    const geos = [];
    for (let c = cx; c < Math.min(W, cx + CHUNK); c++) for (let r = -5; r < H + 5; r++) {
      // rows outside the grid are render-only filler (ceiling above, bedrock below non-pit columns)
      let solid;
      if (r < 0) solid = true; else if (r >= H) solid = level[H - 1][c] === '#'; else solid = isRock(c, r);
      if (!solid) continue;
      const exposedTop = r >= 0 && r < H && !isSolid(c, r - 1) && r - 1 >= 0;
      const g = base.clone();
      const deep = (r >= 0 && r < H) ? (isRock(c, r - 1) && isRock(c, r - 2)) : true;
      const col = (deep ? deepCol : baseCol).clone().multiplyScalar(0.85 + R() * 0.3);
      paintRock(g, col, exposedTop ? iceCol : null, underCol);
      const s = 1 + (R() - 0.5) * 0.06;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(c + 0.5 + (R() - 0.5) * 0.04, wy(r) + 0.5 + (R() - 0.5) * 0.03, ZMID + (R() - 0.5) * 0.22),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.05, (R() - 0.5) * 0.06, (R() - 0.5) * 0.05)),
        new THREE.Vector3(s, exposedTop ? 1 : s, 1));
      g.applyMatrix4(m);
      // tile the texture by world position so neighbours don't repeat the same patch
      const uv = g.attributes.uv; const ou = R(), ov = R();
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5 + ou, uv.getY(i) * 0.5 + ov);
      geos.push(g);
      if (exposedTop) {
        const rim = new THREE.BoxGeometry(1.06, 0.06, 0.06);
        rim.rotateZ((R() - 0.5) * 0.04);
        rim.translate(c + 0.5, wy(r) + 1.0, TILE_Z_FRONT + 0.03); rimGeos.push(rim);
        const back = new THREE.BoxGeometry(1.06, 0.04, 0.04); back.translate(c + 0.5, wy(r) + 1.0, TILE_Z_BACK - 0.0); rimGeos.push(back);
      }
    }
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos), rockMat); scene.add(mesh); world.chunks.push(mesh);
  }

  // ---------- stone columns (connected 'P' groups) ----------
  const colGeos = [], seen = new Set();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (at(c, r) !== 'P' || seen.has(c + ',' + r)) continue;
    let c2 = c; while (at(c2 + 1, r) === 'P') c2++;
    let r2 = r; while (at(c, r2 + 1) === 'P') r2++;
    for (let i = c; i <= c2; i++) for (let j = r; j <= r2; j++) seen.add(i + ',' + j);
    const w = c2 - c + 1, h = r2 - r + 1, x = c + w / 2, top = wy(r) + 1, bot = wy(r2);
    const shaft = new THREE.CylinderGeometry(w * 0.42, w * 0.46, h - 0.3, 8, 1); shaft.translate(x, bot + (h - 0.3) / 2, -0.25);
    paintRock(shaft, new THREE.Color('#4b5f96'), null, null);
    const cap = new RoundedBoxGeometry(w + 0.16, 0.42, 2.0, 2, 0.1); cap.translate(x, top - 0.21, -0.25); paintRock(cap, new THREE.Color('#6a80bd'), iceCol, underCol);
    const cap2 = new RoundedBoxGeometry(w - 0.1, 0.18, 1.7, 1, 0.05); cap2.translate(x, top - 0.5, -0.25); paintRock(cap2, new THREE.Color('#3d4d80'), null, null);
    for (const g of [shaft, cap, cap2]) { if (g.index) { } }
    colGeos.push(...[shaft, cap, cap2].map((g) => g.index ? g.toNonIndexed() : g));
    // glowing bands
    for (const yy of [bot + 0.45, top - 0.75]) { const band = new THREE.TorusGeometry(w * 0.45, 0.028, 4, 16); band.rotateX(Math.PI / 2); band.translate(x, yy, -0.25); rimGeos.push(band); }
    const rimTop = new THREE.BoxGeometry(w + 0.2, 0.05, 0.05); rimTop.translate(x, top, 0.78); rimGeos.push(rimTop);
    world.crystalSpots.push([x, top + 0.3]);
  }
  if (colGeos.length) {
    // strip attributes so cylinder (uv) and rounded boxes match
    const clean = colGeos.map((g) => { const n = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color', 'uv']) if (g.attributes[k]) n.setAttribute(k, g.attributes[k]); return n; });
    scene.add(new THREE.Mesh(mergeGeometries(clean), rockMat));
  }
  // rim/glow lines: one draw call for the whole level
  const rimClean = rimGeos.map((g) => { const n = new THREE.BufferGeometry(); const gg = g.index ? g.toNonIndexed() : g; n.setAttribute('position', gg.attributes.position); return n; });
  scene.add(new THREE.Mesh(mergeGeometries(rimClean), rimMat));

  // ---------- crystals: platforms + decoration + mid layer, one merged mesh ----------
  const crys = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const t = at(c, r);
    if (t === 'C') {
      // crystal platform: a faceted slab with spikes underneath and a few behind
      const slab = new THREE.CylinderGeometry(0.62, 0.5, 1.9, 6, 1); slab.rotateX(Math.PI / 2); slab.rotateZ(Math.PI / 6); slab.scale(0.95, 0.62, 1);
      slab.translate(c + 0.5, wy(r) + 0.62, -0.3);
      const sg = slab.index ? slab.toNonIndexed() : slab; sg.deleteAttribute('uv');
      const n = sg.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color();
      for (let i = 0; i < n; i++) { const yy = sg.attributes.position.getY(i) - wy(r); cc.copy(PALETTE.vio).lerp(PALETTE.mag, Math.max(0, yy)).multiplyScalar(0.42 + 0.25 * ((i / 3 | 0) % 3) / 2); a.set([cc.r, cc.g, cc.b], i * 3); }
      sg.setAttribute('color', new THREE.BufferAttribute(a, 3)); crys.push(sg);
      cluster(crys, c + 0.5, wy(r) + 0.35, -0.3, 0.75, R, { down: true, n: 3 });
      cluster(crys, c + 0.5, wy(r) + 0.9, -1.2, 0.6, R, { n: 2 });
      world.crystalSpots.push([c + 0.5, wy(r) + 0.5]);
    }
    if (t === '#' && r > 0 && !isSolid(c, r - 1) && at(c, r - 1) !== 'G' && R() < 0.33) {
      // floor clusters, mostly at the back edge so they never hide the hero
      cluster(crys, c + 0.5, wy(r) + 0.95, -1.1 - R() * 0.3, 0.7 + R() * 0.7, R);
      if (R() < 0.4) cluster(crys, c + 0.2 + R() * 0.6, wy(r) + 0.95, 0.7, 0.28, R, { n: 2, cols: [PALETTE.cyan, PALETTE.pink] });
      world.crystalSpots.push([c + 0.5, wy(r) + 1.5]);
    }
    if (t === '#' && r < H - 1 && at(c, r + 1) === ' ' && R() < 0.22) {
      cluster(crys, c + 0.5, wy(r) + 0.05, -0.9, 0.6 + R() * 0.5, R, { down: true, cols: [PALETTE.cyan, PALETTE.vio] });
    }
  }
  // mid-layer + abyss crystals (fog fades them)
  for (let i = 0; i < 46; i++) {
    const x = -6 + R() * (W + 12), z = -4 - R() * 12, floor = R() < 0.7;
    cluster(crys, x, floor ? 3.2 + R() * 1.2 : 16.4, z, 1 + R() * 1.8, R, { down: !floor, cols: R() < 0.3 ? [PALETTE.cyan] : undefined });
  }
  for (let i = 0; i < 10; i++) cluster(crys, 18 + R() * 3 + (i % 2) * 18, -2 - R() * 3, -1 - R() * 3, 1.2, R, { cols: [PALETTE.cyan, PALETTE.mag] });
  const crystalMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.18, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 1.25 });
  crystalMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * vColor.rgb * 1.6;'); };
  scene.add(new THREE.Mesh(mergeGeometries(crys), crystalMat));

  // ---------- mid layer: stalactites, rock columns and mounds ----------
  const mid = [];
  const midRock = (g, col) => { const gg = g.index ? g.toNonIndexed() : g; gg.deleteAttribute('uv'); paint(gg, col); mid.push(gg); };
  for (let i = 0; i < 70; i++) {
    const x = -8 + R() * (W + 16), z = -3 - R() * 14, h = 1.2 + R() * 4, rad = 0.3 + R() * 0.8;
    const g = new THREE.ConeGeometry(rad, h, 6 + (R() * 3 | 0), 3); g.rotateX(Math.PI); g.translate(x, 17.2 - h / 2 + R() * 0.6, z);
    jitter(g, R, 0.12); midRock(g, new THREE.Color('#26386a').multiplyScalar(0.8 + R() * 0.4));
  }
  for (let i = 0; i < 16; i++) {
    const x = -4 + i * (W + 8) / 16 + R() * 3, z = -8 - R() * 10, rad = 0.8 + R() * 1.3;
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, 22, 7, 8); g.translate(x, 9, z); jitter(g, R, 0.35);
    midRock(g, new THREE.Color('#1e2d58').multiplyScalar(0.8 + R() * 0.5));
  }
  for (let i = 0; i < 30; i++) {
    const x = -6 + R() * (W + 12), z = -3 - R() * 12, rad = 1 + R() * 2.4;
    const g = new THREE.IcosahedronGeometry(rad, 1); g.scale(1.4, 0.6, 1); g.translate(x, 3.6, z); jitter(g, R, 0.25);
    midRock(g, new THREE.Color('#22335f').multiplyScalar(0.8 + R() * 0.4));
  }
  const midMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, normalMap: null });
  scene.add(new THREE.Mesh(mergeGeometries(mid), midMat));

  // ---------- far backdrop wall ----------
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(260, 110), new THREE.MeshBasicMaterial({ map: backdropTexture(), fog: false, color: new THREE.Color(0.9, 0.95, 1.1) }));
  bd.material.map.repeat.set(2, 1); bd.position.set(W / 2, 9, -48); scene.add(bd);

  // ---------- bump blocks (individual so they can animate) ----------
  const blockGeo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 2, 0.08);
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.6, normalMap: nrm, normalScale: new THREE.Vector2(0.4, 0.4) });
  const rt = runeTextures();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const t = at(c, r); if (t !== 'B' && t !== '?') continue;
    const mat = t === 'B' ? brickMat : new THREE.MeshStandardMaterial({ map: rt.map, emissiveMap: rt.emissive, emissive: new THREE.Color('#ffb340'), emissiveIntensity: 3, roughness: 0.35 });
    const m = new THREE.Mesh(blockGeo, mat); m.position.set(c + 0.5, wy(r) + 0.5, 0); scene.add(m);
    world.blocks.push({ c, r, type: t, mesh: m, bump: 0, used: false, usedMap: rt.used });
  }

  // ---------- coins: one instanced mesh ----------
  const coinPos = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (at(c, r) === 'o') coinPos.push([c + 0.5, wy(r) + 0.5]);
  const extra = world.blocks.filter((b) => b.type === '?').length; // pop-out coins share the pool
  const cg = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 20); cg.rotateX(Math.PI / 2);
  const ct = coinTexture();
  const faceMat = new THREE.MeshStandardMaterial({ map: ct, emissiveMap: ct, emissive: new THREE.Color('#ffd040'), emissiveIntensity: 1.25, metalness: 0.1, roughness: 0.35 });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#ffd040', emissive: '#ffb020', emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.4 });
  const coinMesh = new THREE.InstancedMesh(cg, [sideMat, faceMat, faceMat], coinPos.length + extra);
  coinMesh.frustumCulled = false; scene.add(coinMesh);
  world.coinMesh = coinMesh;
  coinPos.forEach(([x, y], i) => world.coins.push({ x, y, i, taken: false }));
  world.popSlots = Array.from({ length: extra }, (_, k) => coinPos.length + k);

  // ---------- spawns + goal gate ----------
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const t = at(c, r);
    if (t === 'S') world.start = [c + 0.5, wy(r)];
    if (t === 'e') world.enemies.push([c + 0.5, wy(r)]);
    if (t === 'G') world.goal = [c + 0.5, wy(r)];
  }
  world.isSolid = (c, row) => isSolid(c, row);
  return world;
}

function jitter(g, R, amt) {
  const p = g.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
    if (!map.has(k)) map.set(k, [(R() - 0.5) * amt, (R() - 0.5) * amt, (R() - 0.5) * amt]);
    const d = map.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
}

// glowing crystal gate at the goal: pillars + arch (crystal mesh) and a swirling portal
export function buildGate(scene, x, y) {
  const R = rng(99), crys = [];
  for (const sx of [-1.25, 1.25]) for (let k = 0; k < 4; k++) {
    const g = crystalGeo(0.28 + R() * 0.1, 2.6 + R() * 1.2, k % 2 ? PALETTE.cyan : PALETTE.vio, 6);
    g.rotateZ(sx * -0.12 + (R() - 0.5) * 0.2); g.translate(x + sx + (R() - 0.5) * 0.3, y, -0.6 + (R() - 0.5) * 0.6); crys.push(g);
  }
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (k / 6), g = crystalGeo(0.22, 1.1, PALETTE.pink, 5);
    g.rotateZ(a - Math.PI / 2); g.translate(x + Math.cos(a) * 1.35, y + 3.2 + Math.sin(a) * 0.9, -0.6); crys.push(g);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 1.4 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor.rgb * vColor.rgb * 1.8;'); };
  scene.add(new THREE.Mesh(mergeGeometries(crys), mat));
  const pm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uOpen: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uOpen;
      void main(){ vec2 p=(vUv-0.5)*vec2(1.0,1.6); float r=length(p); float a=atan(p.y,p.x);
        float sw=sin(a*5.0 - r*18.0 + uT*4.0)*0.5+0.5; float edge=smoothstep(0.5,0.38,r);
        vec3 c=mix(vec3(0.2,0.9,1.6), vec3(1.6,0.5,1.8), sw) * (0.6+0.8*smoothstep(0.45,0.0,r));
        gl_FragColor=vec4(c*edge*uOpen*(0.55+0.45*sw), 1.0); }`,
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.4), pm); portal.position.set(x, y + 1.7, -0.55); scene.add(portal);
  return portal;
}
