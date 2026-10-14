// props_tiles.js — Task B: the ONE 1024² atlas for the street props and vehicles (K.makeAtlas(PROP_TILES)).
// Bench plates and ads, the crab-shack sign + chalkboard menu, the manhole cover ring, the recycling sticker, number plates and the
// vehicle liveries (harbour water-taxi lettering, a Utz-style snack truck, a MOVING & STORAGE truck, the arabber cart's painted side).
// Real Baltimore wording and colour schemes (Old Bay, Utz, water-taxi branding, arabber red / yellow / green) are RE-DRAWN here from
// text and flat shapes. No logo image, photo or traced artwork is used or embedded. No imports; no Math.random.
export const META = { id: 'props_tiles', kind: 'kit', atlas: 1024, note: 'PROP_TILES for K.makeAtlas()' };

export const PROP_TILES = (() => { // helpers live inside this closure, so concatenated modules cannot collide
const INK = '#14101f', SANS = 'Impact, "Arial Black", sans-serif', SERIF = 'Georgia, serif';
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const shade = (h, f, a = 1) => { const [r, g, b] = hexRgb(h); return `rgba(${cl(r * f)},${cl(g * f)},${cl(b * f)},${a})`; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const fit = (c, txt, x, y, maxW, px, font = SANS, weight = '') => { let s = px; c.font = `${weight} ${s}px ${font}`; while (c.measureText(txt).width > maxW && s > 6) { s -= 1; c.font = `${weight} ${s}px ${font}`; } c.fillText(txt, x, y); return s; };
const centre = (c) => { c.textAlign = 'center'; c.textBaseline = 'middle'; };

function busPlate(c, w, h) {
  c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8); centre(c); c.fillStyle = '#eae6dc';
  fit(c, 'BUS STOP', w * 0.5, h * 0.4, w * 0.5, 30); fit(c, 'INNER HARBOR · ALL ROUTES', w * 0.5, h * 0.78, w * 0.7, 11, SERIF, 'bold');
  c.fillStyle = '#ffd23c'; rr(c, 14, 14, 44, 30, 6); c.fill(); c.fillStyle = INK; c.fillRect(20, 20, 32, 12); c.beginPath(); c.arc(26, 42, 4, 0, 7); c.arc(46, 42, 4, 0, 7); c.fill();
  c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(w - 56, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 8); c.lineTo(w - 30, h * 0.4 - 16); c.lineTo(w - 14, h * 0.4); c.lineTo(w - 30, h * 0.4 + 16); c.lineTo(w - 30, h * 0.4 + 8); c.lineTo(w - 56, h * 0.4 + 8); c.fill();
}
function adOldBay(c, w, h) {
  c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h * 0.62, w, h * 0.38); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4); centre(c);
  c.fillStyle = '#c8302a'; fit(c, 'OLD BAY', w * 0.5, h * 0.32, w - 30, 34); c.fillStyle = '#eae6dc'; fit(c, 'SEAFOOD SEASONING', w * 0.5, h * 0.8, w - 24, 15, SERIF, 'bold');
}
function crabSign(c, w, h) {
  c.fillStyle = '#2f5a3a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.strokeRect(5, 5, w - 10, h - 10); centre(c);
  c.fillStyle = '#f08a50'; fit(c, 'STEAMED', w * 0.5, h * 0.3, w - 60, 40); fit(c, 'CRABS', w * 0.5, h * 0.64, w - 90, 44);
  c.fillStyle = '#eae6dc'; fit(c, 'BY THE DOZEN · OLD BAY', w * 0.5, h * 0.88, w - 50, 12, SERIF, 'bold');
  c.fillStyle = '#c8302a'; for (const sx of [22, w - 22]) { c.beginPath(); c.ellipse(sx, h * 0.5, 10, 7, 0, 0, 7); c.fill(); c.fillRect(sx - 12, h * 0.5 - 12, 4, 6); c.fillRect(sx + 8, h * 0.5 - 12, 4, 6); }
}
function crabMenu(c, w, h) {
  c.fillStyle = '#22302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a6a44'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) c.fillRect(10 + i * 18, 12, 8, h - 24);
  centre(c); c.fillStyle = '#f2e6c8'; fit(c, 'CRAB MENU', w / 2, 24, w - 28, 22, SANS);
  c.strokeStyle = '#f2e6c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 40); c.lineTo(w - 14, 40); c.stroke();
  const rows = [['MEDIUM DOZEN', 'MKT'], ['LARGE DOZEN', 'MKT'], ['CRAB CAKE', '$14'], ['CORN ON COB', '$3'], ['COLD BEER', '$5']];
  rows.forEach(([a, b], i) => { c.textAlign = 'left'; c.fillStyle = '#f2e6c8'; fit(c, a, 14, 56 + i * 17, 70, 12, SERIF, 'bold'); c.textAlign = 'right'; c.fillStyle = '#ffd23c'; c.fillText(b, w - 14, 56 + i * 17); });
  centre(c); c.fillStyle = '#f08a50'; fit(c, 'ASK FOR OLD BAY!', w / 2, h - 12, w - 20, 11, SERIF, 'bold');
}
function manhole(c, w, h) {
  c.clearRect(0, 0, w, h); c.fillStyle = '#4a4a50'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill(); c.strokeStyle = '#2c322e'; c.lineWidth = 5; c.stroke();
  c.strokeStyle = '#2c322e'; c.lineWidth = 2.5; c.beginPath(); c.arc(w / 2, h / 2, w * 0.36, 0, 7); c.stroke(); c.save(); c.beginPath(); c.arc(w / 2, h / 2, w * 0.34, 0, 7); c.clip();
  c.strokeStyle = '#6f6a62'; c.lineWidth = 3; for (let i = -w; i < w * 2; i += 14) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i, h); c.lineTo(i + h, 0); c.stroke(); } c.restore();
  c.fillStyle = '#4a4a50'; c.fillRect(w * 0.18, h * 0.43, w * 0.64, h * 0.14); c.fillStyle = '#c9b48a'; centre(c); fit(c, 'BALTIMORE CITY', w / 2, h / 2 + 1, w * 0.58, 11, SANS);
}
function recycle(c, w, h) {
  c.fillStyle = '#2f5bd3'; rr(c, 2, 2, w - 4, h - 4, 8); c.fill(); c.strokeStyle = '#eae6dc'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#eae6dc'; c.lineWidth = 5; c.lineJoin = 'round';
  for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57, b = a + 1.6; c.beginPath(); c.arc(w / 2, h * 0.42, 15, a, b); c.stroke(); const ex = w / 2 + Math.cos(b) * 15, ey = h * 0.42 + Math.sin(b) * 15; c.fillStyle = '#eae6dc'; c.beginPath(); c.moveTo(ex + Math.cos(b + 1.57) * 7, ey + Math.sin(b + 1.57) * 7); c.lineTo(ex - Math.cos(b + 1.57) * 7, ey - Math.sin(b + 1.57) * 7); c.lineTo(ex + Math.cos(b) * 9, ey + Math.sin(b) * 9); c.fill(); }
  c.fillStyle = '#eae6dc'; centre(c); fit(c, 'RECYCLE', w / 2, h * 0.85, w - 12, 11, SANS);
}
function platePlate(c, w, h) { c.fillStyle = '#eae6dc'; rr(c, 1, 1, w - 2, h - 2, 4); c.fill(); c.strokeStyle = '#2f5bd3'; c.lineWidth = 2; c.stroke(); centre(c); c.fillStyle = '#2f5bd3'; fit(c, 'MARYLAND', w / 2, h * 0.24, w - 12, 8, SERIF, 'bold'); c.fillStyle = INK; fit(c, '5CX 4821', w / 2, h * 0.64, w - 8, 15, SANS); }
function taxiSide(c, w, h) { // harbour water-taxi lettering: white hull panel, navy stripe, blue block letters, a yellow band and a little crab
  c.fillStyle = '#eae6dc'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 10); c.fillStyle = '#2a3f6a'; c.fillRect(0, h - 18, w, 18); centre(c);
  c.fillStyle = '#2a3f6a'; fit(c, 'BALTIMORE WATER TAXI', w * 0.54, h * 0.46, w * 0.78, 36); c.fillStyle = '#c8302a'; c.beginPath(); c.ellipse(32, h * 0.46, 18, 12, 0, 0, 7); c.fill();
  c.fillRect(14, h * 0.46 - 18, 5, 9); c.fillRect(45, h * 0.46 - 18, 5, 9); c.fillStyle = '#eae6dc'; c.fillRect(24, h * 0.46 - 6, 4, 4); c.fillRect(36, h * 0.46 - 6, 4, 4);
  c.fillStyle = '#eae6dc'; fit(c, 'INNER HARBOR · FELLS POINT · CANTON', w * 0.5, h - 9, w * 0.7, 11, SERIF, 'bold');
}
function taxiBow(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); centre(c); c.fillStyle = '#e8b830'; fit(c, 'WATER', w / 2, h * 0.32, w - 20, 22); c.fillStyle = '#eae6dc'; fit(c, 'TAXI', w / 2, h * 0.72, w - 40, 24); }
function truckUtz(c, w, h) { // Utz-style delivery truck livery drawn from text
  c.fillStyle = '#d8a828'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f5bd3'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#c8302a'; c.fillRect(0, h - 28, w, 6); centre(c);
  c.lineWidth = 8; c.strokeStyle = '#eae6dc'; c.lineJoin = 'round'; c.font = `italic bold 70px ${SERIF}`; c.strokeText('Utz', w * 0.3, h * 0.42); c.fillStyle = '#c8302a'; c.fillText('Utz', w * 0.3, h * 0.42);
  c.fillStyle = '#2f5bd3'; fit(c, 'POTATO CHIPS', w * 0.72, h * 0.3, w * 0.4, 20); c.fillStyle = INK; fit(c, 'PRETZELS · POPCORN · CHEESE CURLS', w * 0.72, h * 0.55, w * 0.46, 11, SERIF, 'bold');
  c.fillStyle = '#eae6dc'; fit(c, 'HANOVER, PA · FRESH SINCE 1921', w / 2, h - 11, w - 20, 11, SERIF, 'bold');
}
function truckMove(c, w, h) { c.fillStyle = '#2a3f6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd23c'; c.fillRect(0, h * 0.76, w, 6); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'MOVING & STORAGE', w / 2, h * 0.38, w - 30, 38); c.fillStyle = '#eae6dc'; fit(c, 'CHARM CITY MOVERS · BALTIMORE · SINCE 1952', w / 2, h * 0.64, w - 30, 13, SERIF, 'bold'); c.fillStyle = '#eae6dc'; fit(c, 'LOCAL · LONG DISTANCE · PIANOS', w / 2, h * 0.9, w - 40, 11, SERIF); }
function arabberSide(c, w, h) { // painted wooden cart side: red field, yellow scrollwork, green border, a lettered banner
  c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f5a3a'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.strokeStyle = '#e8b830'; c.lineWidth = 3; c.strokeRect(12, 12, w - 24, h - 24);
  c.lineCap = 'round'; for (let i = 0; i < 4; i++) { const x = 30 + i * 62; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, h / 2); c.bezierCurveTo(x + 14, h / 2 + s * 30, x + 40, h / 2 + s * 8, x + 28, h / 2 + s * 20); c.stroke(); c.beginPath(); c.arc(x + 28, h / 2 + s * 20, 4, 0, 7); c.stroke(); } }
  c.fillStyle = '#2f5a3a'; rr(c, 34, h * 0.36, w - 68, h * 0.28, 8); c.fill(); c.strokeStyle = '#e8b830'; c.lineWidth = 2.5; c.stroke(); centre(c); c.fillStyle = '#ffd23c'; fit(c, 'FRESH FRUIT & VEGGIES', w / 2, h * 0.5, w - 90, 20, SANS);
}
function dragonScales(c, w, h) { c.fillStyle = '#b8302a'; c.fillRect(0, 0, w, h); for (let y = 0; y < h + 8; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < w + 8; x += 16) { c.fillStyle = '#d84a30'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI); c.fill(); c.strokeStyle = '#7a1f1a'; c.lineWidth = 1.5; c.stroke(); } c.fillStyle = '#e8b830'; c.fillRect(0, 0, w, 6); }

const T = (w, h, draw) => ({ w, h, draw });
const PT = {
  taxi_side: T(384, 96, taxiSide), truck_utz: T(320, 112, truckUtz), truck_move: T(320, 112, truckMove), arabber_side: T(256, 112, arabberSide), crab_sign: T(256, 96, crabSign),
  crab_menu: T(128, 160, crabMenu), bus_plate: T(256, 64, busPlate), ad_oldbay: T(192, 64, adOldBay), taxi_bow: T(128, 64, taxiBow), dragon_scales: T(128, 64, dragonScales),
  manhole: T(128, 128, manhole), recycle: T(64, 64, recycle), plate: T(64, 32, platePlate),
};
return PT;
})();
