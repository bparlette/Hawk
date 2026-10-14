// node spritetest2.js URL OUTDIR : 390x844 test of the shared sprite sections (16-bit tweaks) on the 16-bit trailer page
const NodeURL = require("url").URL; const { chromium } = require("/workspace/work/ss_trailer/node_modules/playwright"); const fs = require("fs");
const [PAGE, OUT = "st2"] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const pv = process.env.HTTPS_PROXY || process.env.HTTP_PROXY; const pu = pv && !/127\.0\.0\.1|localhost/.test(PAGE) ? new NodeURL(pv) : null;
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(pu ? { proxy: { server: pu.protocol + "//" + pu.host, username: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password) } } : {}) });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await c.newPage();
  const errs = [], reqs = []; p.on("pageerror", (e) => errs.push("pageerror " + e)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("request", (r) => reqs.push(r.url())); p.on("requestfailed", (r) => { if (!/\.(mp4|webm)/.test(r.url())) errs.push("failed " + r.url() + " " + (r.failure() || {}).errorText); });
  if (!pu) await p.route("https://shellshock-sprites.surge.sh/**", (r) => { const f = "/workspace/work/sprites/out" + new NodeURL(r.request().url()).pathname; fs.existsSync(f) ? r.fulfill({ path: f, contentType: "image/png" }) : r.fulfill({ status: 404 }); });
  const spr = () => reqs.filter((u) => /sprites\.json|shellshock-sprites/.test(u));
  await p.goto(PAGE, { waitUntil: "load", timeout: 90000 });
  await p.waitForFunction(() => { const v = document.getElementById("hv"); return v && v.currentTime > 1.5; }, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  console.log("INITIAL", JSON.stringify(await p.evaluate(() => { const v = document.getElementById("hv"); return { t: +v.currentTime.toFixed(2), paused: v.paused, src: v.currentSrc.split("/").pop(), vw: v.videoWidth, cards: document.querySelectorAll(".scard").length, sprImgs: document.querySelectorAll(".spr img").length, title: document.title, h1: document.querySelector("h1").textContent, play: [...document.querySelectorAll("a.play")].map((a) => a.href) }; })), "sprite requests:", spr().length);
  await p.screenshot({ path: OUT + "/01_top.png" });
  let first = null;
  for (let y = 0; y < 400000; y += 700) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(120);
    const d = await p.evaluate(() => ({ cast: document.getElementById("cast").getBoundingClientRect().top, sy: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    if (first === null && spr().length) { first = d; console.log("sprites.json first requested when #cast top was", Math.round(d.cast), "px from viewport top (vh 844), first sprite url:", spr()[0]); }
    if (d.cast < 200 || d.sy >= d.max) break; }
  await p.evaluate(() => document.getElementById("cast").scrollIntoView()); await p.waitForFunction(() => document.querySelectorAll("#cast .scard").length > 0, null, { timeout: 30000 }); await p.waitForTimeout(2500);
  const r1 = await p.evaluate(() => { const ims = [...document.querySelectorAll("#cast img")]; const vis = ims.filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return { cardsRenderedSoFar: document.querySelectorAll("#cast .scard").length, imgs: ims.length, lazyAll: ims.every((i) => i.getAttribute("loading") === "lazy" && i.getAttribute("decoding") === "async"), only16: ims.every((i) => /\/16bit\//.test(i.src)),
      allPixelated: ims.every((i) => getComputedStyle(i).imageRendering === "pixelated"), visLoaded: vis.filter((i) => i.complete && i.naturalWidth > 0).length + "/" + vis.length, maxH: Math.max(...ims.map((i) => i.height)),
      groups: [...document.querySelectorAll("#cast .sgrp h3")].map((h) => h.textContent), jump: [...document.querySelectorAll("#cast .stool button")].map((b) => b.textContent), lv: [...document.querySelectorAll("#cast .slv")].slice(0, 6).map((s) => s.textContent), scrollW: document.documentElement.scrollWidth }; });
  console.log("CAST", JSON.stringify(r1)); await p.screenshot({ path: OUT + "/02_cast.png" });
  await p.locator("#cast .spose").first().click(); await p.waitForTimeout(700);
  const lb = () => p.evaluate(() => { const l = document.getElementById("slb"), i = l.querySelector("img"); return { open: l.classList.contains("on"), cap: l.querySelector(".lcap").textContent, src: i.src.split("surge.sh")[1], nat: [i.naturalWidth, i.naturalHeight], shown: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)], pix: getComputedStyle(i).imageRendering }; });
  const l1 = await lb(); await p.screenshot({ path: OUT + "/03_lightbox.png" });
  await p.click("#slb .ln"); await p.waitForTimeout(500); const l2 = await lb(); await p.click("#slb .lp"); await p.click("#slb .lp"); await p.waitForTimeout(500); const l3 = await lb();
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); console.log("LIGHTBOX", JSON.stringify([l1, l2, l3, { openAfterEsc: (await lb()).open }]));
  await p.fill("#cast .stool input", "shred"); await p.waitForTimeout(1500);
  console.log("FILTER shred", JSON.stringify(await p.evaluate(() => ({ visible: [...document.querySelectorAll("#cast .scard:not([hidden])")].map((c) => c.querySelector("b").textContent), groups: [...document.querySelectorAll("#cast .sgrp:not([hidden]) h3")].map((h) => h.firstChild.textContent) }))));
  await p.screenshot({ path: OUT + "/04_filter.png" }); await p.fill("#cast .stool input", ""); await p.waitForTimeout(800);
  await p.click("#cast .stool button:has-text('Enemies')"); await p.waitForTimeout(2500);
  console.log("JUMP Enemies -> group top px", await p.evaluate(() => Math.round(document.getElementById("cast-enemy").getBoundingClientRect().top)));
  await p.evaluate(() => document.getElementById("versus").scrollIntoView()); await p.waitForFunction(() => document.querySelectorAll("#versus .scard").length > 0, null, { timeout: 30000 }); await p.waitForTimeout(2500);
  console.log("VS", JSON.stringify(await p.evaluate(() => { const s = document.getElementById("versus"), ims = [...s.querySelectorAll("img")]; const vis = ims.filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    const first = s.querySelector(".spair"); return { h2: s.querySelector("h2").textContent, link: [...s.querySelectorAll("a")].map((a) => a.href), cardsSoFar: s.querySelectorAll(".scard").length, pairs: s.querySelectorAll(".spair").length,
      firstPairOrder: first ? [...first.querySelectorAll("figcaption")].map((f) => f.textContent) : null, b16px: ims.filter((i) => /\/16bit\//.test(i.src)).every((i) => getComputedStyle(i).imageRendering === "pixelated"),
      lazyAll: ims.every((i) => i.getAttribute("loading") === "lazy"), visLoaded: vis.filter((i) => i.complete && i.naturalWidth > 0).length + "/" + vis.length, scrollW: document.documentElement.scrollWidth }; })));
  await p.screenshot({ path: OUT + "/05_vs.png" });
  for (let k = 0; k < 40; k++) { await p.evaluate(() => scrollBy(0, 600)); await p.waitForTimeout(250); }
  console.log("VS after scrolling", JSON.stringify(await p.evaluate(() => ({ cards: document.querySelectorAll("#versus .scard").length, pairs: document.querySelectorAll("#versus .spair").length, scrollW: document.documentElement.scrollWidth }))));
  await p.screenshot({ path: OUT + "/06_vs_more.png" });
  console.log("HERO after scroll", JSON.stringify(await p.evaluate(() => { const v = document.getElementById("hv"); return { t: +v.currentTime.toFixed(2), paused: v.paused }; })), "sprite requests:", spr().length);
  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 10)));
  await b.close();
})().catch((e) => { console.error("TEST FAILED", e); process.exit(1); });
