const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ args: ["--mute-audio"] }); const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
  await p.goto("http://127.0.0.1:8775/index.html?level=6"); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const cv = document.getElementById("game"); const x = cv.getContext("2d"); x.fillStyle = "#357"; x.fillRect(0, 0, 1152, 672);
    for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i},70%,50%)`; x.fillRect(Math.random() * 1100, Math.random() * 600, 50, 50); }
    const sm = document.createElement("canvas"); sm.width = 535; sm.height = 312; const s = sm.getContext("2d");
    const T = (fn) => { const t = performance.now(); for (let i = 0; i < 20; i++) fn(); return ((performance.now() - t) / 20).toFixed(1); };
    return {
      high: T(() => { s.imageSmoothingQuality = "high"; s.drawImage(cv, 0, 0, 535, 312); }),
      low: T(() => { s.imageSmoothingQuality = "low"; s.drawImage(cv, 0, 0, 535, 312); }),
      jpgSmall: T(() => sm.toDataURL("image/jpeg", 0.9)),
      jpgFull: T(() => cv.toDataURL("image/jpeg", 0.85)),
      webpSmall: T(() => sm.toDataURL("image/webp", 0.9)),
    };
  });
  console.log(JSON.stringify(r)); await b.close();
})();
