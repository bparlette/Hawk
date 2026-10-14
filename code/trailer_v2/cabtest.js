// cabtest.js GAMEURL TRAILERURL OUT : WebKit iPhone 14 portrait 390x844 - game title vs trailer hero, cabinet geometry + inputs
const { webkit, devices } = require("./pw_new/node_modules/playwright"); const fs = require("fs");
const [G, T, OUT = "pagetest"] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const geo = () => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((x) => +x.toFixed(2)); };
  return { vp: [innerWidth, innerHeight], cab: q("#cab"), screen: q("#screen"), stick: q("#stick"), capA: q("#cap-a"), capB: q("#cap-b"), capP: q("#cap-p"), fxA: q("#fx-a"),
    S: getComputedStyle(document.getElementById("cab")).getPropertyValue("--S"), bg: getComputedStyle(document.getElementById("cab")).backgroundImage.slice(-40), row: getComputedStyle(document.getElementById("screen")).getPropertyValue("--row") }; };
(async () => {
  const pu = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
  const b = await webkit.launch({ proxy: { server: pu.protocol + "//" + pu.host, username: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password), bypass: "127.0.0.1,localhost" } });
  const ctx = async () => b.newContext({ ...devices["iPhone 14"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } });
  const cg = await ctx(), pg = await cg.newPage();
  await pg.route(/surge\.sh/, async (route) => { try { const r = await route.fetch(); await route.fulfill({ response: r }); } catch (e) { route.abort(); } });
  await pg.goto(G, { waitUntil: "load", timeout: 90000 }); await pg.waitForTimeout(2500);
  console.log("GAME", JSON.stringify(await pg.evaluate(geo)));
  await pg.screenshot({ path: OUT + "/game_title.png" });
  const ct = await ctx(), pt = await ct.newPage(); const errs = []; pt.on("pageerror", (e) => errs.push(String(e)));
  await pt.goto(T, { waitUntil: "load", timeout: 90000 });
  let playing = true; try { await pt.waitForFunction(() => { const v = document.getElementById("hv"); return v && v.currentTime > 1.5; }, null, { timeout: 40000 }); } catch (e) { playing = false; }
  console.log("TRAILER", JSON.stringify(await pt.evaluate(geo)));
  console.log("VIDEO", playing, JSON.stringify(await pt.evaluate(() => { const v = document.getElementById("hv"), r = v.getBoundingClientRect();
    return { src: v.currentSrc, t: v.currentTime, paused: v.paused, muted: v.muted, inline: v.playsInline, fs: !!v.webkitDisplayingFullscreen, vbox: [r.left, r.top, r.width, r.height], vw: v.videoWidth, vh: v.videoHeight }; })));
  // input sync: sample DOM while playing
  const samp = await pt.evaluate(async () => { const o = new Set(), st = new Set(); for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 100));
      o.add(["a", "b", "p"].filter((k) => document.getElementById("cap-" + k).classList.contains("on")).join("") || "-"); st.add(document.getElementById("stick").style.transform); }
    return { lit: [...o], stick: [...st].length, t: document.getElementById("hv").currentTime }; });
  console.log("ANIM", JSON.stringify(samp));
  await pt.evaluate(() => { const v = document.getElementById("hv"); v.pause(); v.currentTime = 6.0; }); await pt.waitForTimeout(1200);
  await pt.screenshot({ path: OUT + "/trailer_hero.png" });
  // level clips + stills: game-only landscape, inline
  await pt.evaluate(() => document.getElementById("hv").play());
  const lv = await pt.evaluate(() => [...document.querySelectorAll("video.mini")].map((v) => { const r = v.getBoundingClientRect(); return [v.getAttribute("src"), +(r.width / r.height).toFixed(3), Math.round(r.width), v.controls]; }));
  console.log("MINIS", lv.length, JSON.stringify(lv.slice(0, 2)), "aspects", [...new Set(lv.map((x) => x[1]))]);
  const gi = await pt.evaluate(() => { const im = [...document.querySelectorAll(".gal img")]; return { n: im.length, asp: [...new Set(im.map((i) => +(i.getBoundingClientRect().width / i.getBoundingClientRect().height).toFixed(2)))], nat: [...new Set(im.map((i) => i.getAttribute("width") + "x" + i.getAttribute("height")))] }; });
  console.log("STILLS", JSON.stringify(gi));
  await pt.locator("#level6").scrollIntoViewIfNeeded();
  await pt.evaluate(() => document.querySelector("#level6").scrollIntoView());
  await pt.tap("#level6 video.mini"); await pt.waitForTimeout(2500);
  console.log("L6PLAY", JSON.stringify(await pt.evaluate(() => { const v = document.querySelector("#level6 video.mini"); return { t: v.currentTime, paused: v.paused, fs: !!v.webkitDisplayingFullscreen, pip: !!document.pictureInPictureElement, vw: v.videoWidth, vh: v.videoHeight }; })));
  await pt.evaluate(() => { document.querySelector("#level6 video.mini").pause(); });
  for (let i = 0; i < 30; i++) { const ok = await pt.evaluate(() => [...document.querySelectorAll("#level6 .gal img")].every((i) => i.complete && i.naturalWidth > 0)); if (ok) break; await pt.waitForTimeout(300); }
  await pt.screenshot({ path: OUT + "/trailer_level6.png" });
  console.log("errors", JSON.stringify(errs)); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
