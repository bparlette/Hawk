// shot_home.js <baseUrl> <outPrefix> : screenshot the home-page Gallery at 390x844 and 1280x720.
// Run under: flock /workspace/work/toad-city/locks/chrome.flock node shot_home.js http://127.0.0.1:8792/home/ qa/home
// Writes <outPrefix>_gallery_390.png, <outPrefix>_gallery_1280.png (Gallery top, after scrolling it into view so the
// lazy clips load), <outPrefix>_gallery_full_390.png (the whole Gallery section) and prints load / error stats.
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
const [url, out] = process.argv.slice(2);
(async () => {
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  for (const [w, h, mob] of [[390, 844, true], [1280, 720, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/youtube|ytimg|google|net::ERR|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
    await p.goto(url, { waitUntil: 'load', timeout: 90000 });
    const before = await p.evaluate(() => [...document.querySelectorAll('.x-gal__vid')].filter((v) => v.src).length);
    await p.evaluate(() => document.getElementById('gallery').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => { const v = [...document.querySelectorAll('.x-gal__vid')];
      const r = document.getElementById('gallery').getBoundingClientRect();
      return { cards: v.length, loaded: v.filter((x) => x.src).length, playing: v.filter((x) => x.src && !x.paused).length, hOverflow: document.documentElement.scrollWidth > innerWidth, galleryH: Math.round(r.height),
        clips: !!document.getElementById('clips') }; });
    await p.screenshot({ path: `${out}_gallery_${w}.png` });
    if (w === 390) { const el = await p.$('#gallery'); await el.screenshot({ path: `${out}_gallery_full_390.png` }); }
    if (w === 1280) { await p.evaluate(() => { const g = document.querySelectorAll('.x-gal__grid')[2]; g && g.scrollIntoView({ behavior: 'instant' }); }); await p.waitForTimeout(1500); await p.screenshot({ path: `${out}_gallery_grid_1280.png` }); }
    console.log(JSON.stringify({ w, h, lazyBeforeScroll: before, ...st, errors: errs.slice(0, 5) }));
    await ctx.close();
  }
  await b.close();
})();
