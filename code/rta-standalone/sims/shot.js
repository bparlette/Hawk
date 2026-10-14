// node shot.js <game.html> <out.ppm> <frames> [holdKey]  -- software-canvas screenshot (fillRect/drawImage/arc/transform; gradients use mid stop)
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const src = html.slice(html.indexOf("(function () {", html.lastIndexOf("<script>")), html.lastIndexOf("</script>"));
const N = +process.argv[4] || 300, HOLD = process.argv[5] || "";
function parseCol(c) {
  if (typeof c === "object" && c && c.__g) { const st = c.stops; c = st.length ? st[Math.floor(st.length / 2)][1] : "#000"; }
  c = String(c).trim(); let m;
  if (c[0] === "#") { let h = c.slice(1); if (h.length === 3) h = h.split("").map((x) => x + x).join(""); const n = parseInt(h.slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  if ((m = /rgba?\(([^)]*)\)/.exec(c))) { const p = m[1].split(",").map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  const named = { white: [255, 255, 255, 1], black: [0, 0, 0, 1] }; return named[c] || [255, 0, 255, 1];
}
function Canvas(w, h) { this.width = w; this.height = h; this.style = {}; this._d = null; }
Canvas.prototype.getContext = function () { if (!this._c) this._c = new Ctx(this); return this._c; };
function Ctx(cv) { this.cv = cv; this.m = [1, 0, 0, 1, 0, 0]; this.st = []; this.fillStyle = "#000"; this.strokeStyle = "#000"; this.globalAlpha = 1; this.lineWidth = 1; this.path = []; }
Ctx.prototype.buf = function () { const c = this.cv; if (!c._d || c._d.length !== c.width * c.height * 4) c._d = new Float32Array(c.width * c.height * 4); return c._d; };
Ctx.prototype.px = function (x, y, col) { const c = this.cv; x |= 0; y |= 0; if (x < 0 || y < 0 || x >= c.width || y >= c.height) return; const d = this.buf(), i = (y * c.width + x) * 4, a = col[3] * this.globalAlpha; d[i] = d[i] * (1 - a) + col[0] * a; d[i + 1] = d[i + 1] * (1 - a) + col[1] * a; d[i + 2] = d[i + 2] * (1 - a) + col[2] * a; d[i + 3] = Math.min(1, d[i + 3] + a); };
Ctx.prototype.tp = function (x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; };
Ctx.prototype.fillRect = function (x, y, w, h) { const col = parseCol(this.fillStyle); const a = this.tp(x, y), b = this.tp(x + w, y + h); const x0 = Math.round(Math.min(a[0], b[0])), x1 = Math.round(Math.max(a[0], b[0])), y0 = Math.round(Math.min(a[1], b[1])), y1 = Math.round(Math.max(a[1], b[1])); for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.px(xx, yy, col); };
Ctx.prototype.clearRect = function (x, y, w, h) { const s = this.globalAlpha; this.globalAlpha = 1; const f = this.fillStyle; this.fillStyle = "#000"; this.fillRect(x, y, w, h); this.fillStyle = f; this.globalAlpha = s; };
Ctx.prototype.drawImage = function (img, dx, dy, dw, dh) { if (!img || !img._d) return; if (arguments.length > 5) { const a = arguments; return this.drawImage(img, a[5], a[6], a[7], a[8]); } dw = dw || img.width; dh = dh || img.height; const sx = img.width / dw, sy = img.height / dh; for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const i = ((y * sy | 0) * img.width + (x * sx | 0)) * 4, d = img._d; if (d[i + 3] <= 0) continue; const p = this.tp(dx + x + 0.5, dy + y + 0.5); this.px(Math.floor(p[0]), Math.floor(p[1]), [d[i], d[i + 1], d[i + 2], d[i + 3]]); } };
Ctx.prototype.save = function () { this.st.push([this.m.slice(), this.fillStyle, this.strokeStyle, this.globalAlpha]); };
Ctx.prototype.restore = function () { const s = this.st.pop(); if (s) { this.m = s[0]; this.fillStyle = s[1]; this.strokeStyle = s[2]; this.globalAlpha = s[3]; } };
Ctx.prototype.transform = function (a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; };
Ctx.prototype.translate = function (x, y) { this.transform(1, 0, 0, 1, x, y); };
Ctx.prototype.scale = function (x, y) { this.transform(x, 0, 0, y, 0, 0); };
Ctx.prototype.rotate = function (r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); };
Ctx.prototype.setTransform = function (a, b, c, d, e, f) { this.m = typeof a === "object" ? [1, 0, 0, 1, 0, 0] : [a, b, c, d, e, f]; };
Ctx.prototype.resetTransform = function () { this.m = [1, 0, 0, 1, 0, 0]; };
Ctx.prototype.beginPath = function () { this.path = []; };
Ctx.prototype.moveTo = function (x, y) { this.path.push(["m", this.tp(x, y)]); };
Ctx.prototype.lineTo = function (x, y) { this.path.push(["l", this.tp(x, y)]); };
Ctx.prototype.closePath = function () {};
Ctx.prototype.rect = function (x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); };
Ctx.prototype.arc = function (cx, cy, r, a0, a1) { a1 = Math.min(a1, a0 + 6.2832); const n = 24; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.path.push([this.path.length ? "l" : "m", this.tp(cx + Math.cos(a) * r, cy + Math.sin(a) * r)]); } };
Ctx.prototype.ellipse = function (cx, cy, rx, ry, rot, a0, a1) { const n = 24; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.path.push([this.path.length ? "l" : "m", this.tp(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)]); } };
Ctx.prototype.quadraticCurveTo = function (a, b, x, y) { this.lineTo(x, y); }; Ctx.prototype.bezierCurveTo = function (a, b, c, d, x, y) { this.lineTo(x, y); };
Ctx.prototype.fill = function () { const pts = this.path.map((p) => p[1]); if (pts.length < 3) return; const col = parseCol(this.fillStyle); let y0 = Math.floor(Math.min(...pts.map((p) => p[1]))), y1 = Math.ceil(Math.max(...pts.map((p) => p[1]))); for (let y = y0; y <= y1; y++) { const xs = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y + 0.5) !== (b[1] <= y + 0.5)) xs.push(a[0] + (y + 0.5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, col); } };
Ctx.prototype.stroke = function () { const col = parseCol(this.strokeStyle); let prev = null; for (const [t, p] of this.path) { if (t === "l" && prev) { const n = Math.max(1, Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]))); for (let i = 0; i <= n; i++) this.px(Math.floor(prev[0] + (p[0] - prev[0]) * i / n), Math.floor(prev[1] + (p[1] - prev[1]) * i / n), col); } prev = p; } };
Ctx.prototype.strokeRect = function (x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.lineTo(x, y); this.stroke(); };
Ctx.prototype.createLinearGradient = Ctx.prototype.createRadialGradient = function () { const g = { __g: 1, stops: [] }; g.addColorStop = (o, c) => g.stops.push([o, c]); return g; };
Ctx.prototype.createPattern = function () { return "#444"; };
Ctx.prototype.measureText = function (s) { return { width: String(s).length * 6 }; };
["fillText", "strokeText", "setLineDash", "clip"].forEach((k) => (Ctx.prototype[k] = function () {}));
const noop = () => {};
const main = new Canvas(320, 240);
const mkEl = () => Object.assign(new Canvas(320, 240), { addEventListener: noop, dataset: {}, classList: { add: noop, remove: noop }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 240 }), offsetHeight: 100, offsetWidth: 50 });
const el = mkEl();
const winL = {}; let rafCb = null;
global.document = { getElementById: (id) => (id === "c" ? el : mkEl()), querySelectorAll: () => [], createElement: () => new Canvas(1, 1) };
global.window = { addEventListener: (n, f) => { (winL[n] = winL[n] || []).push(f); }, innerWidth: 1280, innerHeight: 900, requestAnimationFrame: (f) => { rafCb = f; }, location: { search: "", hash: "" }, history: { replaceState: noop }, localStorage: { getItem: () => null, setItem: noop } };
global.getComputedStyle = () => ({ display: "none" }); global.setTimeout = noop; global.URLSearchParams = URLSearchParams;
let rng = 5; Math.random = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
new Function("window", "document", "requestAnimationFrame", src)(window, document, (f) => window.requestAnimationFrame(f));
const key = (type, code) => (winL[type] || []).forEach((f) => f({ code, preventDefault: noop }));
let ts = 0;
for (let i = 0; i < N; i++) {
  if (HOLD !== "TITLE" && (i === 2 || i === 60)) key("keydown", "KeyZ"); if (i === 4 || i === 62) key("keyup", "KeyZ");
  if (HOLD && HOLD !== "TITLE" && i === 70) HOLD.split(",").forEach((k) => key("keydown", k));
  ts += 1000 / 60; const cb = rafCb; rafCb = null; cb(ts);
}
const d = el._d || new Float32Array(320 * 240 * 4), out = Buffer.alloc(320 * 240 * 3);
for (let i = 0; i < 320 * 240; i++) { out[i * 3] = d[i * 4]; out[i * 3 + 1] = d[i * 4 + 1]; out[i * 3 + 2] = d[i * 4 + 2]; }
fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from("P6 320 240 255\n"), out]));
console.log("shot ok");
