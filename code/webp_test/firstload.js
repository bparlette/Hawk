// bytes requested from navigation until the title screen renders (scene === "title" plus one frame)
const pw = require("/workspace/work/freeze_test/node_modules/playwright");
const { spawn } = require("child_process");
const [dir, port] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn("python3", ["-m", "http.server", port, "--bind", "127.0.0.1"], { cwd: dir, stdio: "ignore" });
  await sleep(1200);
  const env = Object.assign({}, process.env); for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]) delete env[k];
  const b = await pw.webkit.launch({ env });
  const c = await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
  await c.addInitScript(() => { window.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 16); });
  const p = await c.newPage(); const reqs = []; let stop = false;
  p.on("response", async (r) => { if (stop) return; const e = { u: r.url().replace(/^https?:\/\/[^/]+\//, ""), s: r.status(), n: 0 }; reqs.push(e); try { e.n = (await r.body()).length; } catch (_) {} });
  await p.goto(`http://127.0.0.1:${port}/index.html?debug`, { waitUntil: "commit" });
  await p.waitForFunction(() => window.__SS && __SS.STATE.scene === "title", null, { timeout: 60000, polling: 50 });
  await sleep(150); stop = true; await sleep(500);
  const tot = reqs.reduce((a, e) => a + e.n, 0);
  const by = {}; for (const e of reqs) { const x = (e.u.match(/\.(\w+)(\?|$)/) || [, "other"])[1]; by[x] = (by[x] || 0) + e.n; }
  console.log(JSON.stringify({ dir, requests: reqs.length, bytes: tot, byType: by, top: reqs.sort((a, b) => b.n - a.n).slice(0, 6).map((e) => e.u + " " + e.n) }));
  await b.close(); srv.kill();
})();
