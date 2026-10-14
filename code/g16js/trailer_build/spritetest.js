// node spritetest.js URL OUTDIR : lazy sprite sections test at 390x844 (chromium-1134 via ss_trailer playwright 1.47)
const NodeURL = require("url").URL; const { chromium } = require("/workspace/work/ss_trailer/node_modules/playwright"); const fs = require("fs");
const [URL, OUT = "spritetest"] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const pv = process.env.HTTPS_PROXY || process.env.HTTP_PROXY; const pu = pv && !/127\.0\.0\.1|localhost/.test(URL) ? new NodeURL(pv) : null;
  const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(pu ? { proxy: { server: pu.protocol + "//" + pu.host, username: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password), bypass: "127.0.0.1,localhost" } } : {}) });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await c.newPage();
  const errs = [], reqs = []; p.on("pageerror", (e) => errs.push("pageerror " + e)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("request", (r) => reqs.push(r.url())); p.on("requestfailed", (r) => { if (!/\.(mp4|webm)/.test(r.url())) errs.push("failed " + r.url() + " " + (r.failure() || {}).errorText); });
  if (!pu) await p.route("https://shellshock-sprites.surge.sh/**", (r) => { const f = "/workspace/work/sprites/out" + new NodeURL(r.request().url()).pathname; fs.existsSync(f) ? r.fulfill({ path: f, contentType: "image/png" }) : r.fulfill({ status: 404 }); });
  const spr = () => reqs.filter((u) => /sprites\.json|shellshock-sprites/.test(u));
  await p.goto(URL, { waitUntil: "load", timeout: 90000 });
  await p.waitForFunction(() => { const v = document.getElementById("hv"); return v && v.currentTime > 1.5; }, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  const r0 = await p.evaluate(() => { const v = document.getElementById("hv"); return { t: +v.currentTime.toFixed(2), paused: v.paused, src: v.currentSrc.split("/").pop(), cards: document.querySelectorAll(".scard").length, imgs: document.querySelectorAll(".spr img").length, title: document.title, h1: document.querySelector("h1").textContent, play: [...document.querySelectorAll("a.play")].map((a) => a.href) }; });
  console.log("INITIAL", JSON.stringify(r0), "sprite requests:", spr().length);
  await p.screenshot({ path: OUT + "/01_top.png" });
  // scroll down step by step to the levels guide, logging when sprites.json gets requested relative to #cast
  let firstAt = null;
  for (let y = 0; y < 400000; y += 700) {
    await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(120);
    const d = await p.evaluate(() => ({ cast: document.getElementById("cast").getBoundingClientRect().top, sy: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
    if (firstAt === null && spr().length) { firstAt = d; console.log("SPRITES.JSON first requested when #cast top was", Math.round(d.cast), "px below viewport top (vh 844)"); }
    if (d.cast < 300 || d.sy >= d.max) break;
  }
  await p.waitForFunction(() => document.querySelectorAll("#cast .scard").length >= 62, null, { timeout: 30000 });
  await p.evaluate(() => document.getElementById("cast").scrollIntoView()); await p.waitForTimeout(2500);
  const r1 = await p.evaluate(() => { const ims = [...document.querySelectorAll("#cast img")]; const vis = ims.filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return { castCards: document.querySelectorAll("#cast .scard").length, castImgs: ims.length, lazyAll: ims.every((i) => i.loading === "lazy" && i.decoding === "async"), only16: ims.every((i) => /\/16bit\//.test(i.src)),
      pixelated: getComputedStyle(ims[0]).imageRendering, visLoaded: vis.filter((i) => i.complete && i.naturalWidth > 0).length + "/" + vis.length, maxH: Math.max(...ims.map((i) => i.height)),
      groups: [...document.querySelectorAll("#cast .sgrp h3")].map((h) => h.textContent), jump: [...document.querySelectorAll("#cast .sjump button")].map((b) => b.textContent),
      lv: [...document.querySelectorAll("#cast .slv")].slice(0, 6).map((s) => s.textContent), scrollW: document.documentElement.scrollWidth, vsCards: document.querySelectorAll("#vs .scard").length }; });
  console.log("CAST", JSON.stringify(r1));
  console.log("OVERFLOW", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest("#hero")).slice(0, 8).map((e) => e.tagName + "." + e.className + " " + Math.round(e.getBoundingClientRect().right)))));
  await p.screenshot({ path: OUT + "/02_cast.png" });
  // lightbox
  await p.locator("#cast button[data-ci]").first().click(); await p.waitForTimeout(600);
  const lb = async () => p.evaluate(() => { const l = document.getElementById("slb"), i = l.querySelector("img"); return { open: !l.hidden, cap: l.querySelector("figcaption").textContent, nat: [i.naturalWidth, i.naturalHeight], shown: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)], pix: getComputedStyle(i).imageRendering }; });
  const l1 = await lb(); await p.screenshot({ path: OUT + "/03_lightbox.png" });
  await p.click(".slb-n"); await p.waitForTimeout(400); const l2 = await lb(); await p.click(".slb-p"); await p.click(".slb-p"); await p.waitForTimeout(400); const l3 = await lb();
  await p.keyboard.press("Escape"); await p.waitForTimeout(200); const l4 = await lb();
  console.log("LIGHTBOX", JSON.stringify([l1, l2, l3, { openAfterEsc: l4.open }]));
  // filter + jump
  await p.fill("#cast .sfilter", "shred"); await p.waitForTimeout(300);
  const f = await p.evaluate(() => ({ visible: [...document.querySelectorAll("#cast .scard:not([hidden])")].map((c) => c.querySelector("b").textContent), groupsShown: [...document.querySelectorAll("#cast .sgrp:not([hidden]) h3")].map((h) => h.firstChild.textContent) }));
  console.log("FILTER shred", JSON.stringify(f)); await p.screenshot({ path: OUT + "/04_filter.png" });
  await p.fill("#cast .sfilter", ""); await p.waitForTimeout(300);
  await p.click("#cast .sjump button:has-text('Enemies')"); await p.waitForTimeout(4000);
  console.log("JUMP Enemies -> group top", await p.evaluate(() => Math.round(document.getElementById("cast-enemy").getBoundingClientRect().top)));
  // VS section
  await p.evaluate(() => document.getElementById("vs").scrollIntoView()); await p.waitForTimeout(800);
  await p.waitForFunction(() => document.querySelectorAll("#vs .scard").length >= 62, null, { timeout: 30000 });
  await p.waitForTimeout(2000);
  const v = await p.evaluate(() => { const ims = [...document.querySelectorAll("#vs img")]; const vis = ims.filter((i) => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    return { vsCards: document.querySelectorAll("#vs .scard").length, pairs: document.querySelectorAll("#vs .pair").length, painted: ims.filter((i) => /\/painted\//.test(i.src)).length, b16: ims.filter((i) => /\/16bit\//.test(i.src)).length,
      lazyAll: ims.every((i) => i.loading === "lazy" && i.decoding === "async"), visLoaded: vis.filter((i) => i.complete && i.naturalWidth > 0).length + "/" + vis.length, links: [...document.querySelectorAll("#vs a")].map((a) => a.href), scrollW: document.documentElement.scrollWidth,
      loadedTotal: ims.filter((i) => i.complete && i.naturalWidth > 0).length }; });
  console.log("VS", JSON.stringify(v)); await p.screenshot({ path: OUT + "/05_vs.png" });
  await p.evaluate(() => scrollBy(0, 2400)); await p.waitForTimeout(1200); await p.screenshot({ path: OUT + "/06_vs_more.png" });
  const hv = await p.evaluate(() => { const v = document.getElementById("hv"); return { t: +v.currentTime.toFixed(2), paused: v.paused }; });
  console.log("HERO after scroll", JSON.stringify(hv), "sprite png requests so far:", spr().length);
  console.log("ERRORS", errs.length, JSON.stringify(errs.slice(0, 10)));
  await b.close();
})().catch((e) => { console.error("TEST FAILED", e); process.exit(1); });
