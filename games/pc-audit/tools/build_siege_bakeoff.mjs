// build_siege_bakeoff.mjs — Audit-driven Motel Siege interior cutaway bake-off
// 1) Copies shipped BEFORE assets untouched to shots/siege-interiors-bakeoff/before/
// 2) Generates painterly #210f2e-inked AFTER upgrades into shots/siege-interiors-bakeoff/after/
// 3) Renders true in-engine BEFORE vs AFTER phone-size bake-off sheets (Golden t=0.25 + Dusk t=0.68) via page.route
// Usage: CHROME=/path/to/chrome node tools/build_siege_bakeoff.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SIEGE = path.join(ROOT, 'assets', 'siege');
const BAKE = path.join(ROOT, 'shots', 'siege-interiors-bakeoff');
const BEFORE = path.join(BAKE, 'before');
const AFTER = path.join(BAKE, 'after');
const TMP = '/tmp/siege_bakeoff_png';
for (const d of [BAKE, BEFORE, AFTER, TMP]) fs.mkdirSync(d, { recursive: true });

const cwebp = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';

// Step 1: Copy untouched BEFORE shipped interior & furniture/hatch sheets
const BEFORE_FILES = [
  'motel_color.webp', 'motel_night.webp',
  'barricade_desk_intact.webp', 'barricade_desk_damaged.webp',
  'barricade_mattress.webp', 'barricade_dresser.webp',
  'prop_roof_hatch_closed.webp', 'prop_roof_hatch_open.webp',
  'prop_ext_ladder.webp', 'prop_neon_motel_sign.webp',
];
for (const f of BEFORE_FILES) {
  fs.copyFileSync(path.join(SRC_SIEGE, f), path.join(BEFORE, f));
}

const loadW = (f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(BEFORE, f)).toString('base64');
const inputs = {
  color: loadW('motel_color.webp'),
  night: loadW('motel_night.webp'),
  desk0: loadW('barricade_desk_intact.webp'),
  desk1: loadW('barricade_desk_damaged.webp'),
  mattress: loadW('barricade_mattress.webp'),
  dresser: loadW('barricade_dresser.webp'),
  hatch0: loadW('prop_roof_hatch_closed.webp'),
  hatch1: loadW('prop_roof_hatch_open.webp'),
};

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1664, height: 1105 } });

await page.setContent(`<body style="margin:0;background:transparent;"><script>
const INK = '#210f2e';
function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function inkLine(g, x0, y0, x1, y1, lw = 3.2, col = INK) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
function inkBox(g, x, y, w, h, fill, lw = 3.2) {
  if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
  g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, y, w, h);
}

window.buildAfter = async (inp) => {
  const out = {};

  // ---- 1. Upgraded AFTER motel_color.webp (1664x1105): preserve exact layout/sunbeams, lift muddy Kuwahara warmth & add crisp #210f2e ink + painted room storytelling
  {
    const base = new Image(); base.src = inp.color; await new Promise(r => base.onload = r);
    const [c, g] = make(1664, 1105);
    // Warm sunlit richness boost over baked Cycles base
    g.filter = 'saturate(1.30) contrast(1.06) brightness(1.14)';
    g.drawImage(base, 0, 0);
    g.filter = 'none';

    // Crisp wall/room pastel glazes (subtle screen/soft-light brightening so interiors pop at dusk & day!)
    g.save();
    g.globalCompositeOperation = 'soft-light';
    // F0 Lobby warm terracotta-sand sheen
    g.fillStyle = 'rgba(255, 206, 152, 0.36)'; g.fillRect(298, 834, 962, 230);
    // F1 coral-rose left & center rooms + warm apricot
    g.fillStyle = 'rgba(255, 162, 178, 0.38)'; g.fillRect(298, 594, 304, 226);
    g.fillStyle = 'rgba(255, 214, 148, 0.34)'; g.fillRect(604, 594, 654, 226);
    // F2 seafoam-teal rooms + honey gold suite right
    g.fillStyle = 'rgba(148, 234, 222, 0.32)'; g.fillRect(298, 344, 632, 232);
    g.fillStyle = 'rgba(255, 220, 140, 0.34)'; g.fillRect(932, 344, 326, 232);
    g.restore();

    // Wainscoting chair-rail & hallway floor runners per floor
    // F0 terracotta floor tile trim + check-in crimson runner
    g.fillStyle = 'rgba(196, 62, 76, 0.42)'; g.fillRect(306, 1054, 948, 12);
    inkLine(g, 302, 996, 598, 996, 2.2, 'rgba(33,15,46,0.45)');
    // F1 & F2 floor carpet strips & baseboard trim
    g.fillStyle = 'rgba(176, 64, 88, 0.45)'; g.fillRect(306, 811, 948, 9);
    g.fillStyle = 'rgba(64, 148, 144, 0.40)'; g.fillRect(306, 569, 948, 9);

    // Crisp painted window mullions, sky panes & shutter ink outlines across all 8 motel windows
    const wins = [
      // F2 (y=378..496)
      [424, 378, 174, 118, '#4d7ad1'], [786, 378, 174, 118, '#4d7ad1'], [1072, 378, 174, 118, '#dfaa38'],
      // F1 (y=638..748)
      [360, 638, 174, 112, '#dfaa38'], [758, 638, 174, 112, '#4d7ad1'], [1006, 638, 174, 112, '#4d7ad1'],
      // F0 (y=882..992)
      [672, 882, 168, 110, '#d95b8b'], [998, 882, 168, 110, '#dfaa38'],
    ];
    for (const [wx, wy, ww, wh, shut] of wins) {
      // Crisp sky glass sheen + louvered slats
      g.fillStyle = 'rgba(178, 224, 255, 0.20)'; g.fillRect(wx + 24, wy + 4, ww - 48, wh - 8);
      g.strokeStyle = 'rgba(255, 250, 236, 0.35)'; g.lineWidth = 1.5;
      for (let ly = wy + 14; ly < wy + wh - 10; ly += 12) {
        g.beginPath(); g.moveTo(wx + 28, ly); g.lineTo(wx + ww - 28, ly); g.stroke();
      }
      // Window frame & mullions
      inkBox(g, wx + 24, wy + 2, ww - 48, wh - 4, null, 2.8);
      inkLine(g, wx + ww / 2, wy + 2, wx + ww / 2, wy + wh - 2, 2.4);
      inkLine(g, wx + 24, wy + wh / 2, wx + ww - 24, wy + wh / 2, 2.4);
      // Side shutters
      inkBox(g, wx, wy, 24, wh, shut, 2.6);
      inkBox(g, wx + ww - 24, wy, 24, wh, shut, 2.6);
    }

    // Crisp retro painted CHECK IN lobby sign replacing blurry Kuwahara letters
    inkBox(g, 366, 882, 186, 64, '#241432', 3.4);
    g.save();
    g.font = '900 30px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ff5798';
    g.fillText('CHECK IN', 459, 914);
    g.restore();

    // Crisp #210f2e structural slab, wall, stair rail & ladder contours so foreground props sit inside one unified ink world!
    inkBox(g, 294, 324, 970, 22, '#4a3548', 3.2);  // Roof slab
    inkBox(g, 294, 576, 970, 18, '#3f2a3d', 3.0);  // F2 floor slab
    inkBox(g, 294, 818, 970, 18, '#3f2a3d', 3.0);  // F1 floor slab
    inkBox(g, 294, 1064, 970, 14, '#7d6359', 2.8); // Ground apron
    // Outer structural frame + inner pillar edges (aligned cleanly without cutting hallways)
    inkLine(g, 295, 296, 295, 1072, 3.6);
    inkLine(g, 1262, 296, 1262, 1072, 3.6);
    inkLine(g, 616, 344, 616, 1064, 2.2, 'rgba(33,15,46,0.52)');
    inkLine(g, 944, 344, 944, 1064, 2.2, 'rgba(33,15,46,0.52)');
    // Roof HVAC unit + neon pylons
    inkBox(g, 394, 242, 108, 82, null, 3.0);
    inkLine(g, 1054, 152, 1054, 324, 3.0);
    inkLine(g, 1158, 152, 1158, 324, 3.0);
    // Ladder rails & rungs (F2 -> R)
    inkLine(g, 818, 282, 818, 576, 3.0); inkLine(g, 854, 282, 854, 576, 3.0);
    for (let ly = 300; ly < 570; ly += 24) inkLine(g, 818, ly, 854, ly, 2.2);
    // Stair handrails (F1 left stair + F0 right stair)
    inkLine(g, 366, 514, 534, 818, 3.0); inkLine(g, 1018, 1064, 1184, 760, 3.0);
    // East Fire Escape rails & diagonal flight
    inkLine(g, 1262, 576, 1446, 576, 3.2); inkLine(g, 1262, 502, 1446, 502, 2.6);
    inkLine(g, 1446, 502, 1446, 576, 3.0);
    inkLine(g, 1262, 818, 1446, 818, 3.2); inkLine(g, 1262, 748, 1446, 748, 2.6);
    inkLine(g, 1446, 748, 1446, 818, 3.0);
    inkLine(g, 1430, 576, 1272, 818, 3.2);
    // Ceiling light housing pills
    for (const cy of [350, 598, 840]) for (const cx of [456, 768, 1094]) inkBox(g, cx - 18, cy, 36, 9, '#fff3ce', 2.0);
    // Palm tree trunks ink edge emphasis
    inkLine(g, 102, 430, 96, 1064, 2.6, 'rgba(33,15,46,0.55)');
    inkLine(g, 134, 430, 140, 1064, 2.6, 'rgba(33,15,46,0.55)');
    inkLine(g, 1554, 345, 1534, 1064, 2.6, 'rgba(33,15,46,0.55)');
    inkLine(g, 1586, 345, 1572, 1064, 2.6, 'rgba(33,15,46,0.55)');

    out.motel_color = c.toDataURL('image/png');
  }

  // ---- 2. Upgraded AFTER motel_night.webp (1664x1105): key black -> clean alpha + warm saffron sconces, louvered window glow, crisp CHECK IN magenta halo
  {
    const nb = new Image(); nb.src = inp.night; await new Promise(r => nb.onload = r);
    const [c, g] = make(1664, 1105);
    g.drawImage(nb, 0, 0);
    // Warm saffron overhead fixture cones per bay
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const cy of [356, 604, 846]) {
      for (const cx of [456, 768, 1094]) {
        const cone = g.createRadialGradient(cx, cy + 4, 8, cx, cy + 120, 195);
        cone.addColorStop(0.0, 'rgba(255, 240, 190, 0.72)');
        cone.addColorStop(0.35, 'rgba(255, 198, 102, 0.38)');
        cone.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
        g.fillStyle = cone;
        g.beginPath(); g.moveTo(cx - 20, cy); g.lineTo(cx + 20, cy);
        g.lineTo(cx + 150, cy + 215); g.lineTo(cx - 150, cy + 215); g.closePath(); g.fill();
      }
    }
    // Clear blurry old CHECK IN glow region before stamping crisp neon halo
    g.fillStyle = '#000000'; g.fillRect(362, 878, 198, 70);
    // Crisp glowing CHECK IN neon halo
    const nc = g.createRadialGradient(459, 914, 12, 459, 914, 140);
    nc.addColorStop(0, 'rgba(255, 80, 168, 0.72)'); nc.addColorStop(0.5, 'rgba(255, 58, 152, 0.28)'); nc.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = nc; g.beginPath(); g.arc(459, 914, 140, 0, Math.PI * 2); g.fill();
    g.font = '900 30px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3ab2'; g.shadowBlur = 16; g.fillStyle = '#ff9cd0';
    g.fillText('CHECK IN', 459, 914);
    g.restore();
    out.motel_night = c.toDataURL('image/png');
  }

  // ---- 3. Upgrade matching barricades + hatches cleanly (preserve exact dimensions + boost crispness/highlights)
  const polishProp = async (b64, name, fn) => {
    const im = new Image(); im.src = b64; await new Promise(r => im.onload = r);
    const [c, g] = make(im.width, im.height);
    g.filter = 'saturate(1.18) contrast(1.08) brightness(1.05)';
    g.drawImage(im, 0, 0);
    g.filter = 'none';
    if (fn) fn(g, im.width, im.height);
    out[name] = c.toDataURL('image/png');
  };
  await polishProp(inp.desk0, 'barricade_desk_intact', (g, w, h) => {
    g.fillStyle = 'rgba(255,244,205,0.28)'; g.fillRect(6, 6, w - 12, 5);
  });
  await polishProp(inp.desk1, 'barricade_desk_damaged', (g, w, h) => {
    inkLine(g, w * 0.42, 8, w * 0.56, h * 0.52, 2.2);
  });
  await polishProp(inp.mattress, 'barricade_mattress', (g, w, h) => {
    g.strokeStyle = 'rgba(220,78,108,0.45)'; g.lineWidth = 2.5;
    for (let x = 14; x < w - 14; x += 16) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, h - 8); g.stroke(); }
  });
  await polishProp(inp.dresser, 'barricade_dresser', (g, w, h) => {
    g.fillStyle = 'rgba(255,220,160,0.26)'; for (let y = 12; y < h - 14; y += 16) g.fillRect(10, y, w - 20, 3);
  });
  await polishProp(inp.hatch0, 'prop_roof_hatch_closed');
  await polishProp(inp.hatch1, 'prop_roof_hatch_open', (g, w, h) => {
    g.fillStyle = 'rgba(255,228,150,0.25)'; g.fillRect(10, h - 10, w - 20, 6);
  });

  return out;
};
</script></body>`);

const afterImgs = await page.evaluate((inp) => window.buildAfter(inp), inputs);
for (const [name, dataUrl] of Object.entries(afterImgs)) {
  const png = path.join(TMP, `${name}.png`), webp = path.join(AFTER, `${name}.webp`);
  fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execSync(`"${cwebp}" -quiet -q 92 -alpha_q 100 "${png}" -o "${webp}"`);
}
await page.close();

// Step 3: Live in-engine BEFORE vs AFTER bake-off captures at Phone Size (420x860 @ 2x) in Golden (t=0.25) & Dusk (t=0.68)!
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, q.url.split('?')[0].replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => server.listen(0, r));
const PORT = server.address().port;

async function captureEngineShot(tod, useAfter) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  if (useAfter) {
    await p.route('**/assets/siege/*.webp', async (route) => {
      const fn = path.basename(route.request().url().split('?')[0]);
      const cand = path.join(AFTER, fn);
      if (fs.existsSync(cand)) {
        await route.fulfill({ status: 200, contentType: 'image/webp', body: fs.readFileSync(cand) });
      } else {
        await route.continue();
      }
    });
  }
  await p.goto(`http://localhost:${PORT}/index.html?t=${tod}&dpr=2`);
  await p.waitForFunction(() => window.__palm && window.__palm.sim);
  await p.waitForTimeout(3600);
  // Enter Motel Siege cleanly (clear intro flash & settle at identical F1 view)
  await p.evaluate(() => {
    const s = window.__palm.sim, p = s.player.ped, d = s.W.L.motelDoor;
    p.x = d[0]; p.y = d[1]; s.stars = 2;
  });
  await p.keyboard.press('Space');
  await p.waitForFunction(() => window.__palm.sim.player.mode === 'siege');
  await p.waitForTimeout(1000); // wait past enter crossfade cleanly!
  await p.evaluate(() => {
    const s = window.__palm.sim, g = s.siege;
    g.enterT = 2.5; g.t = 32.5;
    s.msgT = 0; s.sayT = 0;
    g.hero.surf = 'F1'; g.hero.z = g.geo.S.floors[1]; g.hero.x = -1.2; g.hero.face = 1; g.cam.x = 0.0;
    g.barricades[0].placed = true; g.barricades[0].cur = g.barricades[0].to;
    g.barricades[1].placed = true; g.barricades[1].cur = g.barricades[1].to;
    window.__palm.sim.step = () => {};
  });
  await p.waitForTimeout(450);
  const buf = await p.screenshot({ type: 'png' });
  await ctx.close();
  return 'data:image/png;base64,' + buf.toString('base64');
}

const gBefore = await captureEngineShot('0.25', false);
const gAfter = await captureEngineShot('0.25', true);
const dBefore = await captureEngineShot('0.68', false);
const dAfter = await captureEngineShot('0.68', true);

const sheetPage = await browser.newPage({ viewport: { width: 1000, height: 1020 } });
await sheetPage.setContent(`<body style="margin:0;background:#160f20;"><canvas id="s" width="1000" height="1020"></canvas><script>
window.makeBakeSheet = async (bSrc, aSrc, label, bgCol) => {
  const bi = new Image(); bi.src = bSrc; await new Promise(r => bi.onload = r);
  const ai = new Image(); ai.src = aSrc; await new Promise(r => ai.onload = r);
  const c = document.getElementById('s'), g = c.getContext('2d');
  g.fillStyle = bgCol; g.fillRect(0, 0, 1000, 1020);
  g.fillStyle = '#20182a'; g.fillRect(0, 0, 1000, 74);
  g.font = 'bold 21px monospace'; g.fillStyle = '#ffe58f'; g.fillText('MOTEL SIEGE INTERIORS BAKE-OFF - ' + label, 28, 34);
  g.font = 'bold 15px monospace';
  g.fillStyle = '#ff9bb0'; g.fillText('BEFORE (Shipped assets/siege/)', 88, 62);
  g.fillStyle = '#7effb2'; g.fillText('AFTER (Candidate shots/.../after/)', 555, 62);
  g.drawImage(bi, 40, 92, 420, 860);
  g.drawImage(ai, 520, 92, 420, 860);
  g.strokeStyle = '#ff9bb0'; g.lineWidth = 3; g.strokeRect(39, 91, 422, 862);
  g.strokeStyle = '#7effb2'; g.lineWidth = 3; g.strokeRect(519, 91, 422, 862);
  return c.toDataURL('image/png');
};
</script></body>`);

fs.writeFileSync(path.join(BAKE, 'bakeoff-golden-phone.png'), Buffer.from((await sheetPage.evaluate(([b, a]) => window.makeBakeSheet(b, a, 'GOLDEN HOUR (t=0.25)', '#2a1c28'), [gBefore, gAfter])).split(',')[1], 'base64'));
fs.writeFileSync(path.join(BAKE, 'bakeoff-dusk-phone.png'), Buffer.from((await sheetPage.evaluate(([b, a]) => window.makeBakeSheet(b, a, 'DUSK NIGHT (t=0.68)', '#14162d'), [dBefore, dAfter])).split(',')[1], 'base64'));

await browser.close();
server.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('Motel Siege interior bake-off complete in', BAKE);
