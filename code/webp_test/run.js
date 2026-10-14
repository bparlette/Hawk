// Headless WebKit smoke test for the Shell Shock builds after the WebP / wake-lock / lint changes.
// usage: node run.js <siteDir> <port> <outDir> [phase...]   phases: arcade gallery lv2 lv8 lv15 nolock
const pw = require("/workspace/work/freeze_test/node_modules/playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const [dir, port, out, ...phases] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INIT = (fakeLock) => {
  const raf = (cb) => setTimeout(() => cb(performance.now()), 16); // headless WebKit rAF shim (as in ss_engine/t/lib.js)
  window.requestAnimationFrame = (f) => raf(f);
  const spc = Element.prototype.setPointerCapture; Element.prototype.setPointerCapture = function (id) { try { return spc.call(this, id); } catch (_) {} };
  window.__WL = { req: 0, rel: 0, native: !!(navigator.wakeLock && navigator.wakeLock.request) };
  try {
    if (fakeLock) {
      const fake = { request(t) { __WL.req++; __WL.type = t; const l = { released: false, type: t, _h: [], addEventListener(e, h) { this._h.push(h); }, release() { __WL.rel++; this.released = true; this._h.forEach((h) => h()); return Promise.resolve(); } }; return Promise.resolve(l); } };
      Object.defineProperty(Navigator.prototype, "wakeLock", { configurable: true, get: () => fake });
    } else Object.defineProperty(Navigator.prototype, "wakeLock", { configurable: true, get: () => undefined });
  } catch (e) { __WL.err = String(e); }
  // runtime RNG audit: simStep swaps Math.random -> RNG.next, so this wrapper only sees native draws (outside steps, or NRAND)
  const nat = Math.random; window.__RA = {};
  Math.random = function () { try { const s = new Error().stack.split("\n").slice(1, 3).map((l) => (l.split("@")[0] || "?").trim() || "?").join("<"); __RA[s] = (__RA[s] || 0) + 1; } catch (_) {} return nat(); };
};
(async () => {
  const srv = spawn("python3", ["-m", "http.server", port, "--bind", "127.0.0.1"], { cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
  const httpLog = []; srv.stderr.on("data", (d) => httpLog.push(String(d)));
  await sleep(1200);
  const env = Object.assign({}, process.env); for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY"]) delete env[k]; env.NO_PROXY = "*";
  const b = await pw.webkit.launch({ env });
  const report = { dir, phases: {} };
  for (const ph of phases) {
    const c = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
    await c.addInitScript(INIT, ph !== "nolock");
    const p = await c.newPage();
    const R = (report.phases[ph] = { errors: [], failed: [], scenes: [], webp: 0, png: 0 });
    p.on("pageerror", (e) => R.errors.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") R.errors.push("console: " + m.text().slice(0, 300)); });
    p.on("requestfailed", (q) => R.failed.push("FAILED " + q.url() + " " + (q.failure() || {}).errorText));
    p.on("response", (r) => { const u = r.url(); if (r.status() >= 400) R.failed.push(r.status() + " " + u); if (/\.webp$/.test(u)) R.webp++; if (/\.png$/.test(u)) R.png++; });
    const scene = () => p.evaluate(() => (window.__SS ? __SS.STATE.scene : "?") + (window.__SS && __SS.STATE.level ? "/L" + __SS.STATE.level : ""));
    const shot = async (n) => { await p.screenshot({ path: `${out}/${ph}_${n}.png` }); R.scenes.push(n + ":" + (await scene())); };
    const key = async (k, gap = 1500) => { await p.keyboard.press(k); await sleep(gap); };
    await p.goto(`http://127.0.0.1:${port}/index.html?debug`, { waitUntil: "load" });
    await sleep(4000); await shot("0title");
    if (ph === "arcade" || ph === "nolock") {
      await key("Enter"); await shot("1menu"); await key("Enter"); await shot("2select"); await key("Enter");
      await sleep(8000); await shot("3stage");
      await p.keyboard.down("ArrowRight"); await sleep(1200); await key("j", 300); await key("j", 300); await key("j", 600); await p.keyboard.up("ArrowRight");
      await sleep(800); await shot("4moved");
      R.player = await p.evaluate(() => (__SS.STATE.player ? { x: Math.round(__SS.STATE.player.x), hp: __SS.STATE.player.hp } : null));
    } else if (ph === "gallery") {
      await key("Enter"); for (let i = 0; i < 4; i++) await key("ArrowDown", 300); await shot("1menu_gal"); await key("Enter", 3500); await shot("2gallery");
      await key("ArrowRight", 400); await key("ArrowDown", 400); await key("ArrowDown", 600); await shot("3gallery_moved");
      await key("Enter", 2500); await shot("4gallery_card");
      for (let i = 0; i < 12; i++) await key("ArrowDown", 150); await sleep(1500); await shot("5gallery_enemies");
      R.gal = await p.evaluate(() => { const imgs = [...document.images].concat([]); return { imgsBroken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src) }; });
    } else if (/^lv\d+$/.test(ph)) {
      const n = +ph.slice(2);
      await key("Enter"); for (let i = 0; i < 3; i++) await key("ArrowDown", 300); await key("Enter", 1200); await shot("1grid");
      for (let i = 1; i < n; i++) await key("ArrowRight", 200); await sleep(600); await shot("2grid_pick"); await key("Enter", 1800); await shot("3select"); await key("Enter");
      await sleep(12000); await shot("4stage");
      await p.keyboard.down("ArrowRight"); await sleep(1000); await key("j", 300); await p.keyboard.up("ArrowRight"); await sleep(1500); await shot("5moved");
    }
    R.wakeLock = await p.evaluate(() => window.__WL);
    R.nativeRng = await p.evaluate(() => window.__RA);
    R.brokenImgs = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    await c.close();
    console.log(ph, JSON.stringify({ scenes: R.scenes, errors: R.errors, failed: R.failed, webp: R.webp, png: R.png, wake: R.wakeLock, broken: R.brokenImgs, player: R.player }));
  }
  await b.close(); srv.kill();
  report.http404 = httpLog.join("").split("\n").filter((l) => / 404 /.test(l));
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
  console.log("404s in server log:", report.http404.length, report.http404.slice(0, 10));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
