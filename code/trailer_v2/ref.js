// Cabinet reference shots for the trailer compositor. Loads the game's own mobile cabinet page
// (portrait 720x1280), freezes the game loop, and screenshots: canvas black / white (to recover the
// CRT overlay), the 9 joystick tilt states and each button's pressed+lit state, using the game's
// own DOM elements, classes and transform formula (updateCabFx). Writes ref/ + ref/geom.json.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const [BASE, OUT = "ref", VW = "720", VH = "1280"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +VW, height: +VH }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 1; }); // game never steps
  await page.goto(BASE + "/index.html?debug", { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const geom = await page.evaluate(() => {
    const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
    return { canvas: r("game"), screen: r("screen"), cab: r("cab"), stick: r("stick"), capA: r("cap-a"), capB: r("cap-b"), capP: r("cap-p"), fxA: r("fx-a"), fxB: r("fx-b"), fxP: r("fx-p") };
  });
  fs.writeFileSync(path.join(OUT, "geom.json"), JSON.stringify(geom, null, 1));
  const fill = (c) => page.evaluate((c) => { const cv = document.getElementById("game"); const x = cv.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = c; x.fillRect(0, 0, cv.width, cv.height); }, c);
  const setState = (dx, dy, on) => page.evaluate(([dx, dy, on]) => {
    document.getElementById("stick").style.transform = `rotate(${dx * 22}deg) translateY(${dy * 2}%) scaleY(${1 - 0.12 * dy})`;
    for (const k of ["a", "b", "p"]) for (const pre of ["fx", "cap", "ring"]) document.getElementById(pre + "-" + k).classList.toggle("on", on.includes(k));
  }, [dx, dy, on]);
  const shot = async (name) => { await page.waitForTimeout(60); await page.screenshot({ path: path.join(OUT, name + ".png") }); };
  await fill("#000"); await setState(0, 0, ""); await shot("black");
  await fill("#fff"); await shot("white");
  await fill("#000");
  for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) { await setState(dx, dy, ""); await shot(`stick_${dx}_${dy}`); }
  for (const k of ["a", "b", "p"]) { await setState(0, 0, k); await shot("btn_" + k); }
  console.log(JSON.stringify(geom));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
