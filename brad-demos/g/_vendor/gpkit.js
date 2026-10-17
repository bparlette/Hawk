// gpkit: the "look" kit. Toon shading, merged low-poly characters (cat, zombie, car), particles, sky, ground textures, blob shadows.
// Everything is built from primitives in code: no downloads, no assets, instancing-friendly (one draw call per character type).
import { THREE as T, rand } from './gp3d.js';

const grad = new T.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1); grad.needsUpdate = true; grad.minFilter = grad.magFilter = T.NearestFilter;
/** 3-step cel material. Pass vertexColors:true for merged geometry (instance colour tints the white parts). */
export const toon = (color = 0xffffff, o = {}) => new T.MeshToonMaterial({ color, gradientMap: grad, ...o });

const SHAPES = { box: () => new T.BoxGeometry(1, 1, 1), sphere: () => new T.SphereGeometry(.5, 9, 7), cone: () => new T.ConeGeometry(.5, 1, 7), cyl: () => new T.CylinderGeometry(.5, .5, 1, 8) };
/** Merge [{g,s,p,r,c}] (shape, scale, position, euler rotation, hex colour) into one vertex-coloured geometry. White parts take the instance colour. */
export function build(parts) {
  const pos = [], nor = [], col = [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), c = new T.Color();
  for (const d of parts) {
    const g = SHAPES[d.g]().toNonIndexed(); e.set(...(d.r || [0, 0, 0])); q.setFromEuler(e); m.compose(new T.Vector3(...(d.p || [0, 0, 0])), q, new T.Vector3(...d.s)); g.applyMatrix4(m);
    c.setHex(d.c ?? 0xffffff); const n = g.attributes.position.count;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < n; i++) col.push(c.r, c.g, c.b);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); return g;
}
const D = 0x151515, PINK = 0xff9fb0;
/** Cat, 1 unit tall, facing +z. Body/head/legs/tail are white (tintable); ears, nose, eyes are fixed. */
export const catGeo = () => build([
  { g: 'sphere', s: [.7, .55, 1], p: [0, .42, 0] }, { g: 'sphere', s: [.6, .52, .52], p: [0, .82, .5] },
  { g: 'cone', s: [.2, .3, .2], p: [-.19, 1.12, .48] }, { g: 'cone', s: [.2, .3, .2], p: [.19, 1.12, .48] }, { g: 'cone', s: [.1, .16, .1], p: [-.19, 1.1, .52], c: PINK }, { g: 'cone', s: [.1, .16, .1], p: [.19, 1.1, .52], c: PINK },
  { g: 'sphere', s: [.1, .14, .06], p: [-.14, .88, .76], c: D }, { g: 'sphere', s: [.1, .14, .06], p: [.14, .88, .76], c: D }, { g: 'sphere', s: [.08, .06, .06], p: [0, .78, .78], c: PINK },
  { g: 'cyl', s: [.1, .75, .1], p: [0, .85, -.6], r: [-.9, 0, 0] }, { g: 'cyl', s: [.16, .35, .16], p: [-.2, .17, .32] }, { g: 'cyl', s: [.16, .35, .16], p: [.2, .17, .32] }, { g: 'cyl', s: [.16, .35, .16], p: [-.2, .17, -.3] }, { g: 'cyl', s: [.16, .35, .16], p: [.2, .17, -.3] }]);
/** Zombie, 1.9 tall, arms out front, facing +z. Head and arms white (tint green); shirt, trousers, eyes, mouth fixed. */
export const zombieGeo = () => build([
  { g: 'box', s: [.62, .8, .36], p: [0, 1.15, 0], c: 0x5b7a99 }, { g: 'sphere', s: [.5, .5, .5], p: [0, 1.78, .04] }, { g: 'box', s: [.1, .1, .05], p: [-.12, 1.82, .3], c: 0xd22 }, { g: 'box', s: [.1, .1, .05], p: [.12, 1.82, .3], c: 0xd22 }, { g: 'box', s: [.22, .06, .05], p: [0, 1.66, .3], c: D },
  { g: 'box', s: [.16, .16, .75], p: [-.42, 1.4, .4] }, { g: 'box', s: [.16, .16, .75], p: [.42, 1.4, .4] }, { g: 'box', s: [.22, .7, .24], p: [-.15, .38, 0], c: 0x3d3d52 }, { g: 'box', s: [.22, .7, .24], p: [.15, .38, 0], c: 0x3d3d52 }, { g: 'box', s: [.64, .14, .38], p: [0, .78, 0], c: 0x2c2c3c }]);
/** Cartoon car, 2 wide, 4.2 long, facing +z. White body takes the colour. */
export const carGeo = () => build([
  { g: 'box', s: [2, .7, 4.2], p: [0, .75, 0] }, { g: 'box', s: [1.6, .55, 2], p: [0, 1.3, -.2], c: 0x20242e }, { g: 'box', s: [1.7, .1, .5], p: [0, 1.2, -1.8], c: 0x222 }, { g: 'box', s: [.5, .25, .08], p: [-.6, .85, 2.1], c: 0xfff3a0 }, { g: 'box', s: [.5, .25, .08], p: [.6, .85, 2.1], c: 0xfff3a0 },
  ...[[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].map(([x, z]) => ({ g: 'cyl', s: [.8, .4, .8], p: [x * 1.02, .4, z], r: [0, 0, Math.PI / 2], c: 0x141414 }))]);

/** Instanced character set: returns {mesh, set(i,x,y,z,scale,yaw,pitch,roll), color(i,hex)} using vertex-coloured toon material. */
/** Shared walk clock: set walkClock.value = st.t each update; crowds created with {legs} swing their legs from it. */
export const walkClock = { value: 0 };
/** Vertex-shader walk cycle: vertices below `legH` swing front/back (opposite per side), arms bob. Phase is per instance so a crowd never marches in step. */
function walkMat(mat, legH, speed) {
  mat.onBeforeCompile = sh => { sh.uniforms.uWalk = walkClock; sh.vertexShader = 'uniform float uWalk;\n' + sh.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
     float lg = clamp(1.0 - position.y / ${legH.toFixed(2)}, 0.0, 1.0); float ph = uWalk * ${speed.toFixed(1)} + instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 2.3;
     transformed.z += sin(ph + sign(position.x) * 1.57) * 0.30 * lg * lg; transformed.y += abs(sin(ph)) * 0.05 * (1.0 - lg);`); };
  return mat;
}
export function crowd(scene, geo, count, tint = true, legs = 0) {
  const mat = toon(0xffffff, { vertexColors: true }); if (legs) walkMat(mat, legs, 11);
  const mesh = new T.InstancedMesh(geo, mat, count); mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; scene.add(mesh);
  const o = new T.Object3D(), c = new T.Color(); o.rotation.order = 'YXZ';
  return { mesh, set(i, x, y, z, s = 1, yaw = 0, pitch = 0, roll = 0) { o.position.set(x, y, z); o.scale.setScalar(s); o.rotation.set(pitch, yaw, roll); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); },
    color(i, hex) { c.setHex(hex); mesh.setColorAt(i, c); }, hsl(i, h, s, l) { c.setHSL(h, s, l); mesh.setColorAt(i, c); }, done(n) { if (n !== undefined) mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } };
}
/** Single non-instanced character (hero) from a merged geometry; returns a Mesh with an inverted-hull outline child. */
export function hero(geo, color = 0xffffff, outline = .05) {
  const m = new T.Mesh(geo, toon(color, { vertexColors: true })); const h = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0x111111, side: T.BackSide })); h.scale.setScalar(1 + outline); m.add(h); return m;
}
/** Cheap particles: dust, goo, confetti, sparks. emit({x,y,z,vx,vy,vz,life,size,color,g,grow}); call update(dt) each step. */
export function particles(scene, max = 500, geo = new T.SphereGeometry(.5, 5, 4)) {
  const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9 }), max); im.frustumCulled = false; im.count = 0; scene.add(im);
  const P = [], o = new T.Object3D(), c = new T.Color();
  return { emit(p) { if (P.length < max) P.push({ g: 9, grow: 0, size: .2, life: 1, color: 0xffffff, vx: 0, vy: 0, vz: 0, ...p, t: 0 }); },
    burst(n, p, spread = 3) { for (let i = 0; i < n; i++) this.emit({ ...p, vx: (p.vx || 0) + rand(-spread, spread), vy: (p.vy || 0) + rand(0, spread), vz: (p.vz || 0) + rand(-spread, spread), size: (p.size || .2) * rand(.6, 1.4) }); },
    update(dt) { for (const p of P) { p.t += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; } for (let i = P.length - 1; i >= 0; i--) if (P[i].t >= P[i].life) P.splice(i, 1);
      P.forEach((p, i) => { const k = 1 - p.t / p.life; o.position.set(p.x, p.y, p.z); o.scale.setScalar(Math.max(.001, (p.size + p.grow * p.t) * (p.fade === false ? 1 : k))); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.setHex(p.color); im.setColorAt(i, c); });
      im.count = P.length; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; } };
}
/** Gradient sky dome + fog. */
export function sky(scene, top = 0x4aa8ff, bottom = 0xfff0c8, fog = [60, 300]) {
  const m = new T.Mesh(new T.SphereGeometry(450, 16, 10), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: { a: { value: new T.Color(top) }, b: { value: new T.Color(bottom) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform vec3 a; uniform vec3 b; varying float h; void main(){ gl_FragColor = vec4(mix(b, a, smoothstep(-.05,.6,h)),1.); }' }));
  scene.add(m); scene.background = new T.Color(bottom); if (fog) scene.fog = new T.Fog(bottom, fog[0], fog[1]); return m;
}
/** Procedural tiling ground texture: 'grass' | 'asphalt' | 'checker' | 'wood' | 'tiles'. */
export function groundTex(kind = 'grass', repeat = 40) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
  const P = { grass: ['#5aa844', '#4e9a3c', '#67b84d'], asphalt: ['#3a3d47', '#33363f', '#444854'], checker: ['#e8e2d0', '#cfc7ae'], wood: ['#a9784a', '#9a6b3f', '#b5855a'], tiles: ['#6b7ab8', '#5a68a4'] }[kind];
  g.fillStyle = P[0]; g.fillRect(0, 0, 256, 256);
  if (kind === 'checker' || kind === 'tiles') { g.fillStyle = P[1]; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128); }
  else for (let i = 0; i < 700; i++) { g.fillStyle = P[1 + (i & 1)]; g.fillRect(Math.random() * 256, Math.random() * 256, kind === 'wood' ? 40 : 3, kind === 'wood' ? 2 : 7); }
  const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = T.SRGBColorSpace; return t;
}
/** Dark soft discs under objects (cheap fake shadows). set(i, x, z, size) then done(n). */
export function blobs(scene, max = 300, y = .03) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const im = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }), max); im.frustumCulled = false; scene.add(im); const o = new T.Object3D(); o.rotation.x = -Math.PI / 2;
  return { set(i, x, z, s) { o.position.set(x, y, z); o.scale.setScalar(s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }, done(n) { im.count = n; im.instanceMatrix.needsUpdate = true; } };
}
