// pagetest.js URL OUTDIR : iPhone-viewport check of the cabinet hero (autoplay muted loop, stick/buttons follow the input timeline)
const { chromium, devices } = require("playwright"); const fs = require("fs");
const [URL, OUT = "pagetest"] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices["iPhone 13"] }); const p = await c.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForFunction(() => { const v = document.getElementById("hv"); return v && v.currentTime > 1.5; }, null, { timeout: 60000 });
  const info = await p.evaluate(() => { const v = document.getElementById("hv"), s = document.getElementById("screen").getBoundingClientRect();
    return { src: v.currentSrc, muted: v.muted, loop: v.loop, autoplay: v.autoplay, playsinline: v.playsInline, paused: v.paused, t: v.currentTime, dur: v.duration,
      vw: v.videoWidth, vh: v.videoHeight, screen: [s.left, s.top, s.width, s.height], vbox: (() => { const r = v.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })(),
      S: getComputedStyle(document.getElementById("cab")).getPropertyValue("--S"), vp: [innerWidth, innerHeight] }; });
  console.log(JSON.stringify(info));
  // seek to frames with known inputs and verify the DOM state matches the timeline
  const res = await p.evaluate(async () => {
    const r = await fetch("v/full_screen_inputs.json").then((x) => x.json()); const D = r.data, v = document.getElementById("hv"), out = [];
    const want = []; for (let f = 0; f < D.length && want.length < 6; f += 7) { const c = D.charCodeAt(f) - 48; if (c >= 9 && !want.some((w) => w.c === c)) want.push({ f, c }); }
    for (const f of [want[0].f, 400, 1200]) if (!want.some((w) => w.f === f)) want.push({ f, c: D.charCodeAt(f) - 48 });
    v.pause();
    for (const w of want) { v.currentTime = (w.f + 0.5) / r.fps; await new Promise((ok) => v.addEventListener("seeked", ok, { once: true })); await new Promise((ok) => setTimeout(ok, 120));
      const cab = document.getElementById("cab"); const lit = ["a", "b", "p"].filter((k) => document.getElementById("cap-" + k).classList.contains("on")).join("");
      out.push({ f: w.f, want: w.c, dom: +cab.getAttribute("data-inp"), lit, stick: document.getElementById("stick").style.transform }); }
    v.play(); return out; });
  console.log(JSON.stringify(res));
  await p.screenshot({ path: OUT + "/iphone_top.png" });
  // a frame with a lit button for the record
  const lf = res.find((x) => x.lit); if (lf) { await p.evaluate((f) => { const v = document.getElementById("hv"); v.pause(); v.currentTime = (f + 0.5) / 30; }, lf.f); await p.waitForTimeout(500); await p.screenshot({ path: OUT + "/iphone_lit.png" }); }
  await p.evaluate(() => { document.getElementById("hv").play(); }); await p.waitForTimeout(1500);
  await p.tap("#snd"); await p.waitForTimeout(400);
  console.log(JSON.stringify(await p.evaluate(() => ({ mutedAfterTap: document.getElementById("hv").muted, paused: document.getElementById("hv").paused, btn: document.getElementById("snd").textContent }))));
  await p.screenshot({ path: OUT + "/iphone_sound.png" });
  await p.screenshot({ path: OUT + "/iphone_full.png", fullPage: true });
  console.log("errors", JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
