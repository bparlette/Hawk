// build_ui_art.mjs — generate 17 crisp @2x phone-legible Jobs + Events UI WebPs + phone contact sheet
// Usage: CHROME=/path/to/chrome node tools/build_ui_art.mjs
// Outputs: shots/ui-art/*.webp + shots/ui-art/ui-art-phone-sheet.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'ui-art');
const SHOTS = path.join(ROOT, 'shots');
const TMP = '/tmp/build_ui_png';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const cwebp = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
const bgB64 = 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, 'job-taxi-dusk.png')).toString('base64');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

await page.setContent(`<body style="margin:0;background:#160f20;"><canvas id="sheet" width="960" height="1220"></canvas><script>
const INK = '#210f2e';
function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x+r, y); g.lineTo(x+w-r, y); g.quadraticCurveTo(x+w, y, x+w, y+r);
  g.lineTo(x+w, y+h-r); g.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  g.lineTo(x+r, y+h); g.quadraticCurveTo(x, y+h, x, y+h-r);
  g.lineTo(x, y+r); g.quadraticCurveTo(x, y, x+r, y); g.closePath();
}
function cardShell(g, w, h, bg0, bg1, stripeCol, iconFn) {
  g.save();
  // Drop shadow
  g.fillStyle = 'rgba(18,8,28,0.55)'; rrect(g, 6, 8, w-12, h-10, 18); g.fill();
  // Dark plum body gradient
  rrect(g, 4, 4, w-12, h-12, 16);
  const gr = g.createLinearGradient(0, 4, w, h);
  gr.addColorStop(0, bg0); gr.addColorStop(1, bg1);
  g.fillStyle = gr; g.fill();
  g.clip();
  // Left accent bar
  g.fillStyle = stripeCol; g.fillRect(4, 4, 14, h-12);
  // Subtle top highlight gleam
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(18, 4, w-26, 22);
  if (iconFn) iconFn(g);
  g.restore();
  // Crisp outer ink + pastel inner rim
  rrect(g, 4, 4, w-12, h-12, 16);
  g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  rrect(g, 6, 6, w-16, h-16, 14);
  g.lineWidth = 2; g.strokeStyle = stripeCol; g.stroke();
}

window.buildUiSet = async (bgSrc) => {
  const out = {};

  // ---- 1. 4 Job Cards (380x104 px @2x -> 190x52 view units in hud.js)
  { // TAXI
    const [c, g] = make(380, 104);
    cardShell(g, 380, 104, 'rgba(34,20,46,0.92)', 'rgba(22,12,32,0.95)', '#ffc83d', (ctx) => {
      // Checkerboard ribbon across top-right corner
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? '#ffc83d' : '#210f2e';
        ctx.fillRect(18 + i * 10, 6, 10, 8);
      }
      // Mini cab emblem
      ctx.fillStyle = '#ffc83d'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      rrect(ctx, 26, 24, 42, 26, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dff5ff'; ctx.fillRect(34, 28, 26, 9);
      ctx.fillStyle = '#fff5cf'; ctx.fillRect(41, 20, 12, 5);
    });
    out.job_card_taxi = c.toDataURL('image/png');
  }
  { // TOW
    const [c, g] = make(380, 104);
    cardShell(g, 380, 104, 'rgba(38,22,42,0.92)', 'rgba(24,12,30,0.95)', '#ff8c38', (ctx) => {
      // Caution stripes top
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#ff8c38' : '#261430';
        ctx.beginPath(); ctx.moveTo(18 + i*14, 4); ctx.lineTo(28 + i*14, 4); ctx.lineTo(22 + i*14, 14); ctx.lineTo(12 + i*14, 14); ctx.fill();
      }
      // Winch hook emblem
      ctx.strokeStyle = '#ffd573'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(46, 22); ctx.lineTo(46, 38); ctx.arc(42, 46, 8, -0.3, Math.PI * 1.15); ctx.stroke();
    });
    out.job_card_tow = c.toDataURL('image/png');
  }
  { // BUS
    const [c, g] = make(380, 104);
    cardShell(g, 380, 104, 'rgba(18,32,52,0.92)', 'rgba(14,18,38,0.95)', '#38d8f5', (ctx) => {
      // Transit line + bus silhouette
      ctx.fillStyle = '#38d8f5'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      rrect(ctx, 26, 22, 42, 28, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e2f9ff'; ctx.fillRect(30, 26, 34, 12);
      ctx.fillStyle = '#210f2e'; ctx.beginPath(); ctx.arc(34, 51, 4.5, 0, 7); ctx.arc(60, 51, 4.5, 0, 7); ctx.fill();
      // 6 stop pips bar
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k < 3 ? '#62d66a' : 'rgba(216,246,255,0.28)';
        ctx.beginPath(); ctx.arc(82 + k * 14, 14, 3.5, 0, 7); ctx.fill();
      }
    });
    out.job_card_bus = c.toDataURL('image/png');
  }
  { // GETAWAY
    const [c, g] = make(380, 104);
    cardShell(g, 380, 104, 'rgba(42,14,36,0.94)', 'rgba(20,8,28,0.96)', '#ff477e', (ctx) => {
      // Bank bag $ emblem
      ctx.fillStyle = '#ff6b98'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(46, 40, 15, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff5cf'; ctx.font = '900 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 46, 41);
    });
    out.job_card_getaway = c.toDataURL('image/png');
  }

  // ---- 2. 4 Fare-Mood Icons (64x64 px @2x -> 32x32 view units)
  const makeMood = (name, ring, faceCol, drawFace) => {
    const [c, g] = make(64, 64);
    g.fillStyle = 'rgba(20,10,30,0.65)'; g.beginPath(); g.arc(32, 34, 27, 0, 7); g.fill();
    g.fillStyle = faceCol; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = ring; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke();
    drawFace(g);
    out[name] = c.toDataURL('image/png');
  };
  makeMood('mood_chill', '#62d66a', '#ffd45c', (g) => {
    // Cool shades + grin
    g.fillStyle = INK; g.fillRect(17, 23, 13, 8); g.fillRect(34, 23, 13, 8); g.fillRect(30, 25, 4, 3);
    g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(32, 36, 9, 0.2, Math.PI - 0.2); g.stroke();
  });
  makeMood('mood_nervous', '#ffb84a', '#ffd45c', (g) => {
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.arc(24, 27, 5, 0, 7); g.arc(40, 27, 5, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(24, 27, 2, 0, 7); g.arc(40, 27, 2, 0, 7); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3; g.beginPath();
    g.moveTo(22, 41); g.quadraticCurveTo(27, 38, 32, 41); g.quadraticCurveTo(37, 44, 42, 41); g.stroke();
    g.fillStyle = '#6ee2ff'; g.beginPath(); g.ellipse(49, 20, 3, 5, 0.2, 0, 7); g.fill();
  });
  makeMood('mood_panic', '#ff5a5a', '#ff8c7a', (g) => {
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.arc(24, 26, 6, 0, 7); g.arc(40, 26, 6, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(24, 26, 2, 0, 7); g.arc(40, 26, 2, 0, 7); g.fill();
    g.beginPath(); g.ellipse(32, 42, 6, 7.5, 0, 0, 7); g.fill();
  });
  makeMood('mood_fed', '#38a8ff', '#213064', (g) => {
    // Gold federal shield + siren split rim
    g.fillStyle = '#ffd45c'; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(32, 16); g.lineTo(45, 22); g.lineTo(42, 40); g.lineTo(32, 48); g.lineTo(22, 40); g.lineTo(19, 22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#210f2e'; g.font = '900 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FED', 32, 33);
  });

  // ---- 3. WRECK IT! Score Banner, Combo Badge & 3 Medals
  {
    const [c, g] = make(440, 120);
    cardShell(g, 440, 120, 'rgba(54,18,32,0.94)', 'rgba(26,12,28,0.96)', '#ff8a2b', (ctx) => {
      ctx.fillStyle = '#ff6a28'; ctx.fillRect(18, 4, 410, 32);
      ctx.font = '900 22px "Arial Black", sans-serif'; ctx.fillStyle = '#fff9ee'; ctx.strokeStyle = INK; ctx.lineWidth = 5;
      ctx.strokeText('WRECK IT!', 32, 27); ctx.fillText('WRECK IT!', 32, 27);
      // Hazard rivets
      ctx.fillStyle = '#ffd45c';
      for (const rx of [404, 418]) { ctx.beginPath(); ctx.arc(rx, 20, 4, 0, 7); ctx.fill(); }
    });
    out.wreck_score_banner = c.toDataURL('image/png');
  }
  {
    const [c, g] = make(160, 96);
    g.save(); g.translate(80, 48); g.rotate(-0.08);
    g.fillStyle = '#ff4838'; g.strokeStyle = INK; g.lineWidth = 4;
    rrect(g, -66, -32, 132, 64, 16); g.fill(); g.stroke();
    rrect(g, -61, -27, 122, 54, 12); g.strokeStyle = '#ffd45c'; g.lineWidth = 2.5; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 34px "Arial Black", sans-serif';
    g.strokeStyle = INK; g.lineWidth = 7; g.strokeText('5x', 0, 2);
    g.fillStyle = '#fff6cf'; g.fillText('5x', 0, 2);
    g.restore();
    out.wreck_combo_badge = c.toDataURL('image/png');
  }
  const makeMedal = (name, col0, col1, rim, rib, tag) => {
    const [c, g] = make(96, 96);
    g.fillStyle = rib; g.strokeStyle = INK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, 56); g.lineTo(24, 88); g.lineTo(38, 78); g.lineTo(48, 88); g.lineTo(58, 78); g.lineTo(72, 88); g.lineTo(66, 56); g.closePath(); g.fill(); g.stroke();
    const gr = g.createLinearGradient(18, 10, 78, 70);
    gr.addColorStop(0, col0); gr.addColorStop(1, col1);
    g.fillStyle = gr; g.beginPath(); g.arc(48, 42, 28, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    g.strokeStyle = rim; g.lineWidth = 2.5; g.beginPath(); g.arc(48, 42, 22, 0, 7); g.stroke();
    g.fillStyle = INK; g.font = '900 22px "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(tag, 48, 43);
    out[name] = c.toDataURL('image/png');
  };
  makeMedal('medal_bronze', '#e3965b', '#9e5628', '#ffcf9e', '#d14c4c', 'B');
  makeMedal('medal_silver', '#f2f7ff', '#9aa8be', '#ffffff', '#3e84db', 'S');
  makeMedal('medal_gold',   '#fff294', '#d9901c', '#fffbe0', '#ff4f79', 'G');

  // ---- 4. 4 VALET Rating Cards (360x160 px @2x -> 180x80 view units)
  const makeValet = (name, bg0, bg1, acc, title, sub) => {
    const [c, g] = make(360, 160);
    cardShell(g, 360, 160, bg0, bg1, acc, (ctx) => {
      // Luggage / valet tag punch hole top right
      ctx.fillStyle = '#fff9ee'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(322, 32, 7, 0, 7); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '900 32px "Arial Black", sans-serif';
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeText(title, 34, 62);
      ctx.fillStyle = acc; ctx.fillText(title, 34, 62);
      ctx.font = '800 18px sans-serif';
      ctx.fillStyle = '#fff5e4'; ctx.fillText(sub, 34, 108);
    });
    out[name] = c.toDataURL('image/png');
  };
  makeValet('valet_card_mint',   'rgba(18,46,52,0.95)', 'rgba(14,24,36,0.96)', '#4be3c2', 'MINT PARK',  'ZERO SCUFFS +250');
  makeValet('valet_card_drift',  'rgba(48,22,52,0.95)', 'rgba(24,14,34,0.96)', '#ff85d0', 'DRIFT BAY',  'STYLE LOCK x2.5');
  makeValet('valet_card_jturn',  'rgba(52,18,44,0.95)', 'rgba(28,10,36,0.96)', '#ffd45c', '180° J-TURN','VIP PRECISION x5');
  makeValet('valet_card_scrape', 'rgba(54,20,24,0.95)', 'rgba(28,12,18,0.96)', '#ff5a5a', 'SCRAPED!',   'BUMPER DENT -50%');

  // ---- 5. Composite legible Phone Showcase Sheet (960x1220)
  const sc = document.getElementById('sheet'), sg = sc.getContext('2d');
  const bg = new Image(); bg.src = bgSrc; await new Promise(r => bg.onload = r);
  sg.fillStyle = '#140c1f'; sg.fillRect(0, 0, 960, 1220);
  sg.fillStyle = '#20182a'; sg.fillRect(0, 0, 960, 62);
  sg.font = 'bold 20px monospace'; sg.fillStyle = '#ffe58f';
  sg.fillText('PALM CITY - JOBS & EVENTS UI ART SET (PHONE-SIZE @2x)', 24, 38);

  // Left: Live 420x860 phone preview mockup with Job Card, Mood Icon, Wreck Score Banner & Valet Card overlaid at actual screen ratios!
  sg.save();
  sg.drawImage(bg, 28, 88, 420, 860);
  sg.strokeStyle = '#6ee2ff'; sg.lineWidth = 3; sg.strokeRect(27, 87, 422, 862);
  const loaded = {};
  for (const [k, v] of Object.entries(out)) { const im = new Image(); im.src = v; await new Promise(r => im.onload = r); loaded[k] = im; }

  // Sample in-phone placement: Taxi Job Card + Mood Chill icon
  sg.drawImage(loaded.job_card_taxi, 28 + 115, 88 + 66, 190, 52);
  sg.fillStyle = '#fff5cf'; sg.font = 'bold 12px sans-serif'; sg.fillText('TAXI DISPATCH', 28 + 162, 88 + 86);
  sg.fillStyle = '#ffd45c'; sg.font = 'bold 11px sans-serif'; sg.fillText('DROP AT NOVA · 0:34', 28 + 162, 88 + 104);
  sg.drawImage(loaded.mood_chill, 28 + 312, 88 + 76, 30, 30);

  // Sample in-phone placement: Wreck Score + Combo + Gold Medal lower-center
  sg.drawImage(loaded.wreck_score_banner, 28 + 100, 88 + 630, 220, 60);
  sg.fillStyle = '#fff9ee'; sg.font = '900 18px sans-serif'; sg.fillText('4,850 PTS', 28 + 118, 88 + 674);
  sg.drawImage(loaded.wreck_combo_badge, 28 + 275, 88 + 615, 76, 46);
  sg.drawImage(loaded.medal_gold, 28 + 186, 88 + 694, 48, 48);

  // Right column: Clean isolated kit breakdown at 1:1 legibility
  const rx = 478;
  sg.font = 'bold 14px monospace'; sg.fillStyle = '#7effb2';
  sg.fillText('JOB CARDS (190x52 vu)', rx, 102);
  ['job_card_taxi','job_card_tow','job_card_bus','job_card_getaway'].forEach((k, i) => {
    sg.drawImage(loaded[k], rx, 114 + i * 74, 240, 66);
  });
  sg.fillText('FARE MOODS (32x32 vu)', rx + 266, 102);
  ['mood_chill','mood_nervous','mood_panic','mood_fed'].forEach((k, i) => {
    sg.drawImage(loaded[k], rx + 274 + (i % 2) * 76, 120 + Math.floor(i / 2) * 76, 64, 64);
  });
  sg.fillText('MEDALS (48x48 vu)', rx + 266, 294);
  ['medal_bronze','medal_silver','medal_gold'].forEach((k, i) => {
    sg.drawImage(loaded[k], rx + 266 + i * 70, 310, 64, 64);
  });

  sg.fillStyle = '#ffb86c';
  sg.fillText('WRECK IT! SCORE PLATE & COMBO', rx, 434);
  sg.drawImage(loaded.wreck_score_banner, rx, 448, 300, 82);
  sg.drawImage(loaded.wreck_combo_badge, rx + 318, 456, 112, 68);

  sg.fillStyle = '#ff85d0';
  sg.fillText('VALET RATING CARDS (360x160 @2x)', rx, 562);
  ['valet_card_mint','valet_card_drift','valet_card_jturn','valet_card_scrape'].forEach((k, i) => {
    sg.drawImage(loaded[k], rx + (i % 2) * 232, 578 + Math.floor(i / 2) * 112, 224, 100);
  });

  // Footer note box
  sg.fillStyle = '#221731'; sg.fillRect(28, 972, 904, 224);
  sg.strokeStyle = '#533b6e'; sg.strokeRect(28, 972, 904, 224);
  sg.fillStyle = '#ffe58f'; sg.font = 'bold 16px monospace';
  sg.fillText('AUDIT + USAGE SUMMARY (100% DROP-IN OVER hud.js)', 48, 1004);
  sg.fillStyle = '#dfd3eb'; sg.font = '14px monospace';
  [
    '• Audited src/hud.js + src/jobs.js: only a plain 190x52 dark box existed; Events & Valet had no UI art.',
    '• All 17 transparent WebPs export at Retina @2x (scale 0.5x cleanly onto 420x860 phone viewport).',
    '• Job cards keep exact 190x52 vu safe area so right-hand timer & left status lines fit verbatim.',
    '• Fare moods replace/augment the 5px bar next to taxi fare meter (Chill / Nervous / Panic / Fed reveal).',
  ].forEach((ln, i) => sg.fillText(ln, 48, 1038 + i * 32));
  sg.restore();

  out._sheet = sc.toDataURL('image/png');
  return out;
};
</script></body>`);

const imgs = await page.evaluate((s) => window.buildUiSet(s), bgB64);
for (const [k, dataUrl] of Object.entries(imgs)) {
  if (k === '_sheet') {
    fs.writeFileSync(path.join(OUT, 'ui-art-phone-sheet.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  } else {
    const png = path.join(TMP, `${k}.png`), webp = path.join(OUT, `${k}.webp`);
    fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
    execSync(`"${cwebp}" -quiet -q 92 -alpha_q 100 "${png}" -o "${webp}"`);
  }
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('Generated 17 UI art WebPs + phone contact sheet in', OUT);
