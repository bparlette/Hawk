// Shared Toad Street 32 landmarks — authentic shop signs, street props.
// Extracted visual identity from brad-demos/g/toad-street-32/game.js:
// sign colors + chunky Impact-style text with hard offset shadow.
import * as THREE from 'three';

export const SHOPS = [
  ['PIZZA', '#7a1f24', '#ffd27a'], ['PAWN', '#1f2a3a', '#ffcf4a'],
  ['DINER', '#2a4a3a', '#ff8a6a'], ['DELI 24H', '#4a2a1a', '#ffe0a0'],
  ['PHARMACY', '#1f3a4a', '#9fe0c8'], ['BAKERY', '#5a3a2a', '#ffd8b0'],
  ['BINGO', '#3a1f3a', '#ff9ad0'], ['LAUNDRO', '#24324a', '#bfe4ff'],
];
const FONT = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';

function canvasTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

// Authentic Toad Street 32 shop sign: black border, colored bg, chunky text + hard shadow.
export function signTexture(text, bg, fg) {
  return canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.fillStyle = bg; x.fillRect(6, 6, w - 12, h - 12);
    x.font = `900 ${text.length > 6 ? 34 : 40}px ${FONT}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#000'; x.fillText(text, w / 2 + 3, h / 2 + 4, w - 24);
    x.fillStyle = fg; x.fillText(text, w / 2, h / 2 + 1, w - 24);
  });
}
export const signTextures = SHOPS.map(([t, bg, fg]) => signTexture(t, bg, fg));

// A Toad Street block: road + sidewalks + 8 shops with authentic signs + hydrants + dumpster.
// Oriented along -z. cx = street center x, z0 = north end, z1 = south end.
export function buildToadStreet(scene, cx, z0, z1) {
  const g = new THREE.Group();
  const len = Math.abs(z1 - z0), zc = (z0 + z1) / 2;
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a958c });

  // road + sidewalks
  const road = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, len), roadMat);
  road.position.set(cx, 0, zc); g.add(road);
  for (const s of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, len), walkMat);
    walk.position.set(cx + s * 9.5, 0.1, zc); g.add(walk);
  }
  // center dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8b040 });
  for (let z = z0; z > z1; z -= 9) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(cx, 0.32, z); g.add(d);
  }

  // shops: 4 per side
  const n = 4, shopW = len / n;
  const wallColors = [0x8a7f70, 0x7a6f60, 0x9a8f80, 0x6f7a80];
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const idx = s < 0 ? i : i + 4;
      const [name] = SHOPS[idx];
      const sz = z0 - (i + 0.5) * shopW;
      // building body
      const bw = 12, bh = 14 + (idx % 3) * 5, bd = shopW * 0.92;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshLambertMaterial({ color: wallColors[idx % 4] }));
      b.position.set(cx + s * (12 + bw / 2), bh / 2, sz); g.add(b);
      // storefront base
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, bd * 0.98),
        new THREE.MeshLambertMaterial({ color: 0x2b2340 }));
      st.position.set(cx + s * 12.4, 2.5, sz); g.add(st);
      // the authentic sign
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5),
        new THREE.MeshBasicMaterial({ map: signTextures[idx] }));
      sign.position.set(cx + s * 11.7, 6.8, sz);
      sign.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(sign);
      // awning
      const awn = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, bd * 0.9),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(SHOPS[idx][1]) }));
      awn.position.set(cx + s * 13, 4.6, sz); g.add(awn);
    }
  }

  // hydrants (red, chunky)
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xc23a2a });
  for (const [hx, hz] of [[cx - 8.1, z0 - 18], [cx + 8.1, z0 - 34]]) {
    const hg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.8, 8), hydMat);
    body.position.y = 0.9; hg.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), hydMat);
    top.position.y = 2; hg.add(top);
    hg.position.set(hx, 0.3, hz); g.add(hg);
  }
  // dumpster (green, in the alley gap)
  const dg = new THREE.Group();
  const db = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 2), new THREE.MeshLambertMaterial({ color: 0x2a6a3a }));
  db.position.y = 0.9; dg.add(db);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 2.1), new THREE.MeshLambertMaterial({ color: 0x1f4a2a }));
  lid.position.y = 1.9; lid.rotation.z = 0.08; dg.add(lid);
  dg.position.set(cx - 13, 0.3, z0 - 30); dg.rotation.y = Math.PI / 2; g.add(dg);

  scene.add(g);
  return g;
}
