// Era 1 — 8-bit top-down. Canvas2D, 208 px wide logical screen, 16 px per tile (4 px per metre).
// All art here is procedural placeholder; Gemini's assets/e1/ atlas replaces it (see ARCHITECTURE.md).
const PPM = 4, TP = 16, VIEW_W = 208;
const PAL = {
  r: "#5a5a66", s: "#c8c0b0", l: "#7c7c88", g: "#58a848", d: "#f0d8a8", p: "#48c8e8", m: "#f08888",
  b: "#f8e098", o: "#2890d0", "~": "#207898", c: "#88889a", B: "#404048",
};
const ROOF = { hotel: ["#d870a8", "#70b8d8", "#f0a060"], shop: ["#e8c040"], diner: ["#e05050"], garage: ["#9898a8"], apartments: ["#b890e0"] };
const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const shade = (hex, k) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, "0")).join("");

// pixel-art sprite from rows of palette keys, then nearest-neighbour rotations (no blur, ever)
function sprite(rows, pal) {
  const c = mk(rows[0].length, rows.length), x = c.getContext("2d");
  rows.forEach((r, j) => [...r].forEach((k, i) => { if (pal[k]) { x.fillStyle = pal[k]; x.fillRect(i, j, 1, 1); } }));
  return c;
}
function rotations(src, n) {
  const w = src.width, h = src.height, S = Math.ceil(Math.hypot(w, h)) | 1, sd = src.getContext("2d").getImageData(0, 0, w, h).data, out = [];
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

// Pip the courier, seen from above, facing north: white cap, orange jacket, teal satchel on the back.
function heroFrames() {
  const pal = { W: "#f8f8f8", w: "#c0c0c8", O: "#f07820", o: "#b85010", S: "#f0b890", K: "#282830", T: "#18a0a0" };
  const frames = [];
  for (const sw of [0, 1, 0, -1]) {
    const g = Array.from({ length: 12 }, () => Array(12).fill("."));
    const put = (x, y, w, h, k) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < 12) g[j][i] = k; };
    put(3, 4 - 2 * sw, 2, 3, "K"); put(7, 4 + 2 * sw, 2, 3, "K");        // feet stride opposite each other
    put(2, 4, 8, 5, "O"); put(3, 3, 6, 1, "O"); put(3, 9, 6, 1, "o");      // jacket
    put(1, 5 + 2 * sw, 1, 2, "S"); put(10, 5 - 2 * sw, 1, 2, "S");        // hands swing against the feet
    put(4, 8, 4, 2, "T");                                                 // satchel
    put(4, 3, 4, 4, "W"); put(5, 2, 2, 1, "w"); put(4, 6, 4, 1, "w");      // cap + brim (front = north)
    frames.push(rotations(sprite(g.map(r => r.join("")), pal), 16));
  }
  return frames;
}
function carSprite(body) {
  const pal = { B: body, b: shade(body, .7), G: "#203850", g: "#4878a0", H: "#fff8c0", R: "#e02020", K: "#181820" };
  const rows = [
    ".HBBBBH.", "BBBBBBBB", "BBBBBBBB", "KBBBBBBK", "KBBBBBBK", "BgGGGGgB", "BGGGGGGB", "BbbbbbbB", "BbbbbbbB",
    "BbbbbbbB", "BbbbbbbB", "BGGGGGGB", "BgGGGGgB", "KBBBBBBK", "KBBBBBBK", "BBBBBBBB", "BBBBBBBB", ".RBBBBR.",
  ];
  return sprite(rows, pal);
}

function paintGround(L, frame) {
  const c = mk(L.w * TP, L.h * TP), x = c.getContext("2d"), G = L.ground;
  for (let ty = 0; ty < L.h; ty++) for (let tx = 0; tx < L.w; tx++) {
    const k = G[ty][tx], px = tx * TP, py = ty * TP;
    x.fillStyle = PAL[k]; x.fillRect(px, py, TP, TP);
    const dot = (col, n, sz = 1) => { x.fillStyle = col; for (let i = 0; i < n; i++) x.fillRect(px + Math.floor(hash(tx * 31 + i, ty * 17 + i * 7) * (TP - sz)), py + Math.floor(hash(tx * 13 + i * 5, ty * 29 + i) * (TP - sz)), sz, sz); };
    if (k === "s") { x.fillStyle = "#a8a090"; x.fillRect(px, py + 7, TP, 1); x.fillRect(px, py + 15, TP, 1); x.fillRect(px + 15, py, 1, TP); }
    else if (k === "g") dot("#408830", 5);
    else if (k === "b") dot("#e0c070", 4);
    else if (k === "d") { x.fillStyle = "#d8b888"; x.fillRect(px, py + 15, TP, 1); x.fillRect(px + 15, py, 1, TP); }
    else if (k === "m") { x.fillStyle = "#f8b0a8"; for (let i = 0; i < 4; i++) x.fillRect(px + i * 4 + ((ty + i) % 2) * 2, py + i * 4, 2, 2); }
    else if (k === "l") dot("#6c6c78", 2);
    else if (k === "p") { x.fillStyle = "#a8f0f8"; x.fillRect(px + ((tx * 5 + ty * 3 + frame * 4) % 10), py + 4, 4, 1); x.fillRect(px + ((tx * 3 + ty * 7 + frame * 4) % 9), py + 11, 5, 1); }
    else if (k === "o" || k === "~") { x.fillStyle = k === "o" ? "#70c0f0" : "#3898b8"; x.fillRect(px + ((tx * 7 + ty * 5 + frame * 6) % 11), py + 3, 5, 1); x.fillRect(px + ((tx * 3 + ty * 11 + frame * 6) % 10), py + 10, 4, 1); }
    else if (k === "c") { x.fillStyle = "#585868"; x.fillRect(px, py + (ty % 2 ? 14 : 0), TP, 2); }
  }
  // pool rims, surf line
  for (const p of L.pools) { x.strokeStyle = "#f8f8f8"; x.lineWidth = 1; x.strokeRect(p.x * TP + .5, p.y * TP + .5, p.w * TP - 1, p.h * TP - 1); }
  x.fillStyle = "#f8f8f8"; for (let y = 0; y < L.h * TP; y += 2) x.fillRect(23 * TP - 1 + ((y / 2 + frame) % 3), y, 2, 2);
  // lane markings: Strand Avenue centre line and each cross street's centre line
  x.fillStyle = "#e8e0a0";
  const ax = L.avenue.x1 * TP;
  for (let y = 0; y < L.h * TP; y += 12) x.fillRect(ax - 1, y, 2, 6);
  for (const st of L.streets) for (let px = 2 * TP; px < 18 * TP; px += 12) { if (px >= 9 * TP - 6 && px < 11 * TP) continue; x.fillRect(px, st.y1 * TP - 1, 6, 2); }
  // buildings: flat roof, lit top/left edge, dark bottom/right edge, a shadow strip on the ground
  L.buildings.forEach((b, i) => {
    const col = ROOF[b.use][i % ROOF[b.use].length], px = b.x * TP, py = b.y * TP, w = b.w * TP, h = b.h * TP, sh = Math.min(6, 1 + (b.floors >> 1));
    x.fillStyle = "#30303a"; x.fillRect(px + sh, py + sh, w, h);
    x.fillStyle = col; x.fillRect(px, py, w, h);
    x.fillStyle = shade(col, 1.25); x.fillRect(px, py, w, 2); x.fillRect(px, py, 2, h);
    x.fillStyle = shade(col, .6); x.fillRect(px, py + h - 2, w, 2); x.fillRect(px + w - 2, py, 2, h);
    x.fillStyle = shade(col, .8);
    for (let j = 0; j < b.h; j++) for (let k2 = 0; k2 < b.w; k2++) if (hash(b.x + k2, b.y + j) > .55) x.fillRect(px + k2 * TP + 5, py + j * TP + 5, 6, 6);
  });
  return c;
}

function paintProps(L, car) {
  const c = mk(L.w * TP, L.h * TP), x = c.getContext("2d");
  for (const p of L.props) {
    const px = p.x * TP, py = p.y * TP;
    if (p.type === "bench") { x.fillStyle = "#885020"; x.fillRect(px + 9, py + 2, 4, 12); x.fillStyle = "#b87838"; x.fillRect(px + 9, py + 2, 2, 12); }
    else if (p.type === "lamp") { x.fillStyle = "#505058"; x.fillRect(px + 6, py + 6, 4, 4); x.fillStyle = "#fff8a0"; x.fillRect(px + 7, py + 7, 2, 2); }
    else if (p.type === "umbrella") { const cols = ["#f04890", "#f8f8f8"]; for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const dx = i - 5.5, dy = j - 5.5; if (dx * dx + dy * dy < 34) { x.fillStyle = cols[(Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4))) % 2]; x.fillRect(px + 2 + i, py + 2 + j, 1, 1); } } }
    else if (p.type === "lifeguard_tower") { x.fillStyle = "#f8f8f8"; x.fillRect(px + 1, py + 1, 14, 14); x.fillStyle = "#e03030"; x.fillRect(px + 1, py + 1, 14, 3); x.fillRect(px + 1, py + 7, 14, 2); x.fillRect(px + 1, py + 12, 14, 3); x.fillStyle = "#885020"; x.fillRect(px + 6, py + 15, 4, 5); }
    else if (p.type === "parked_car") x.drawImage(car[(p.x + p.y) % car.length], px + 4, py - 1);
  }
  return c;
}
function palmSprite() {
  const c = mk(15, 15), x = c.getContext("2d");
  for (let a = 0; a < 7; a++) for (let r = 1; r < 8; r++) {
    const t = a / 7 * 2 * Math.PI + .3;
    x.fillStyle = r > 5 ? "#2c8038" : "#48b048"; x.fillRect(Math.round(7 + Math.cos(t) * r - (r < 5 ? 1 : 0)), Math.round(7 + Math.sin(t) * r), r < 5 ? 2 : 1, r < 5 ? 2 : 1);
  }
  x.fillStyle = "#885020"; x.fillRect(6, 6, 3, 3);
  return c;
}

export function create(canvas, level) {
  const ctx = canvas.getContext("2d");
  const grounds = [paintGround(level, 0), paintGround(level, 1)];
  const parked = ["#e8e8f0", "#e04848", "#4868d8"].map(carSprite);
  const props = paintProps(level, parked), palm = palmSprite();
  const hero = heroFrames(), car = rotations(carSprite("#18b8a8"), 32);
  const LW = level.w * TP, LH = level.h * TP;
  let cam = null;
  return {
    name: "8-bit top-down",
    draw(sim) {
      const cssW = canvas.clientWidth || 420, cssH = canvas.clientHeight || 860;
      const vw = VIEW_W, vh = Math.round(VIEW_W * cssH / cssW);
      if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
      ctx.imageSmoothingEnabled = false;
      const p = sim.player(), lead = sim.mode === "drive" ? sim.car.v * 0.45 : 0;
      const tx = (p.x + Math.sin(p.h) * lead) * PPM - vw / 2, ty = (p.y - Math.cos(p.h) * lead) * PPM - vh / 2;
      cam = cam ? { x: cam.x + (tx - cam.x) * .12, y: cam.y + (ty - cam.y) * .12 } : { x: tx, y: ty };
      const cx = Math.round(Math.max(0, Math.min(LW - vw, cam.x))), cy = Math.round(Math.max(0, Math.min(LH - vh, cam.y)));
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, vw, vh);
      ctx.drawImage(grounds[(sim.tick >> 5) & 1], -cx, -cy);
      ctx.drawImage(props, -cx, -cy);
      const f = level.route.finish;                                       // blinking finish marker
      if ((sim.tick >> 4) & 1) { ctx.fillStyle = "#f8f840"; ctx.fillRect(f.x * TP - 3 - cx, f.y * TP - 3 - cy, 6, 6); }
      const blit = (im, wx, wy) => ctx.drawImage(im, Math.round(wx * PPM - im.width / 2) - cx, Math.round(wy * PPM - im.height / 2) - cy);
      const idx = (h, n) => ((Math.round(h / (2 * Math.PI) * n) % n) + n) % n;
      blit(car[idx(sim.car.h, 32)], sim.car.x, sim.car.y);
      if (sim.mode === "foot") blit(hero[sim.hero.speed > .05 ? Math.floor(sim.hero.phase * 4) % 4 : 0][idx(sim.hero.h, 16)], sim.hero.x, sim.hero.y);
      for (const [px, py] of level.palms) ctx.drawImage(palm, px * TP - cx, py * TP - cy);   // canopies sit above everything
    },
    dispose() {},
  };
}
