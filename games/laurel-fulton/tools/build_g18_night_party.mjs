// build_g18_night_party.mjs — Task G18: Night Party (100 people) Crowd Pack, Placement Maps & Phone Previews
// Generates in games/laurel-fulton/shots/g18-night-party/:
//   - sprites/party_crowd_topdown.webp (640x320, 32 unique #210f2e-inked top-down partygoers)
//   - sprites/party_crowd_cutaway.webp (640x240, 16 unique side-view cutaway partygoers)
//   - sprites/party_props_sheet.webp   (512x256, string lights, beer-pong table, keg, boombox, floats)
//   - placement.json                   (100-person placement coordinates for Kosack & Floyds indoor/outdoor)
//   - g18-crowd-contact-sheet.png      (asset inventory visual check)
//   - g18-night-party-phone.png        (420x860 @2x live night scenes for Kosack pool+basement & Floyds split-foyer)
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'shots', 'g18-night-party');
const SPR_OUT = path.join(OUT, 'sprites');
const TMP = path.join(OUT, '_tmp');
fs.mkdirSync(SPR_OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWEBP = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';

const web = http.createServer((q, r) => {
  const f = path.join(GAMES, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' }); r.end(b); }
  });
});
await new Promise(r => web.listen(0, r));
const PORT = web.address().port;
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });

// Deterministic RNG for reproducible non-cloning crowd placement
function makeRng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const EXISTING_PEDS = [
  'ped_player', 'ped_ped_blue', 'ped_ped_rose', 'ped_ped_straw', 'ped_ped_sun', 'ped_ped_white',
  'fare_tourist', 'fare_chaos', 'fare_vip', 'fare_fed',
  'ped_beach_surfer', 'ped_beach_resort', 'ped_biz_suit', 'ped_biz_exec', 'ped_night_clubber', 'ped_night_velvet',
];

function buildVenuePlacement(venue, rng) {
  const slots = [];
  if (venue === 'kosack') {
    // 62 Outdoor poolside, patio deck, backyard grass, Derby Dr driveway
    const zones = [
      { tag: 'pool_water', n: 8,  uMin: -34, uMax: 22, vMin: -102, vMax: -70, swimmer: true },
      { tag: 'pool_deck',  n: 20, uMin: -58, uMax: 46, vMin: -124, vMax: -56, swimmer: false },
      { tag: 'back_lawn',  n: 20, uMin: -78, uMax: 68, vMin: -158, vMax: -46, swimmer: false },
      { tag: 'driveway',   n: 14, uMin: -18, uMax: 52, vMin: 34,   vMax: 118, swimmer: false },
    ];
    let idx = 0;
    for (const z of zones) {
      for (let i = 0; i < z.n; i++) {
        let u = z.uMin + rng() * (z.uMax - z.uMin);
        let v = z.vMin + rng() * (z.vMax - z.vMin);
        // Keep pool_deck walkers out of pool center rectangle (-36..24, -104..-68)
        if (z.tag === 'pool_deck' && u > -36 && u < 24 && v > -104 && v < -68) {
          v = rng() > 0.5 ? -58 - rng() * 6 : -114 - rng() * 10;
        }
        const useExisting = !z.swimmer && rng() < 0.42;
        slots.push({
          id: `kosack_out_${idx++}`,
          layer: 'outdoor',
          zone: z.tag,
          u: +u.toFixed(1),
          v: +v.toFixed(1),
          facing: +(rng() * Math.PI * 2).toFixed(2),
          scale: +(0.90 + rng() * 0.18).toFixed(2),
          source: useExisting ? 'palm_ped' : 'party_topdown',
          sheetIdx: useExisting ? Math.floor(rng() * EXISTING_PEDS.length) : (z.swimmer ? 24 + (i % 8) : Math.floor(rng() * 24)),
          variantName: useExisting ? EXISTING_PEDS[Math.floor(rng() * EXISTING_PEDS.length)] : `party_td_${z.swimmer ? 24 + (i % 8) : Math.floor(rng() * 24)}`,
          pose: z.swimmer ? 'swim' : (rng() < 0.55 ? 'dance' : rng() < 0.78 ? 'cup' : 'chat'),
          bobPhase: +(rng() * Math.PI * 2).toFixed(2),
        });
      }
    }
    // 38 Indoor Basement Cutaway slots (around x = 0.6..11.4m, lower & landing)
    for (let i = 0; i < 38; i++) {
      const floor = i < 30 ? 'basement' : 'landing';
      const x = +(floor === 'basement' ? 0.6 + rng() * 10.8 : 0.4 + rng() * 1.4).toFixed(2);
      slots.push({
        id: `kosack_in_${i}`,
        layer: 'indoor',
        floor,
        x,
        facing: rng() > 0.5 ? 1 : -1,
        scale: +(0.92 + rng() * 0.14).toFixed(2),
        source: 'party_cutaway',
        sheetIdx: i % 16,
        pose: ['dance', 'cup', 'cheer', 'lean'][i % 4],
        bobPhase: +(rng() * Math.PI * 2).toFixed(2),
      });
    }
  } else {
    // Venue B: The Floyds (building 5313) — 54 Outdoor across paired white/red lawns, twin drives & basketball hoop; 46 Indoor split-foyer
    const zones = [
      { tag: 'hoop_drive_west', n: 18, uMin: -54, uMax: 12,  vMin: 36,  vMax: 132 },
      { tag: 'drive_east_pair', n: 14, uMin: 74,  uMax: 158, vMin: 36,  vMax: 124 },
      { tag: 'between_lawns',   n: 10, uMin: 26,  uMax: 72,  vMin: -36, vMax: 48  },
      { tag: 'backyard_deck',   n: 12, uMin: -34, uMax: 146, vMin: -96, vMax: -40 },
    ];
    let idx = 0;
    for (const z of zones) {
      for (let i = 0; i < z.n; i++) {
        const useExisting = rng() < 0.45;
        slots.push({
          id: `floyds_out_${idx++}`,
          layer: 'outdoor',
          zone: z.tag,
          u: +(z.uMin + rng() * (z.uMax - z.uMin)).toFixed(1),
          v: +(z.vMin + rng() * (z.vMax - z.vMin)).toFixed(1),
          facing: +(rng() * Math.PI * 2).toFixed(2),
          scale: +(0.90 + rng() * 0.18).toFixed(2),
          source: useExisting ? 'palm_ped' : 'party_topdown',
          sheetIdx: useExisting ? Math.floor(rng() * EXISTING_PEDS.length) : Math.floor(rng() * 24),
          variantName: useExisting ? EXISTING_PEDS[Math.floor(rng() * EXISTING_PEDS.length)] : `party_td_${Math.floor(rng() * 24)}`,
          pose: rng() < 0.5 ? 'dance' : rng() < 0.8 ? 'cup' : 'chat',
          bobPhase: +(rng() * Math.PI * 2).toFixed(2),
        });
      }
    }
    // 46 Indoor Split-Foyer slots: 22 downstairs by gaming-dad/fireplace + 24 upstairs main + landing
    for (let i = 0; i < 46; i++) {
      const floor = i < 22 ? 'lower' : i < 42 ? 'main' : 'landing';
      const x = +(floor === 'landing' ? 0.3 + rng() * 1.3 : 3.8 + rng() * 7.8).toFixed(2);
      slots.push({
        id: `floyds_in_${i}`,
        layer: 'indoor',
        floor,
        x,
        facing: rng() > 0.5 ? 1 : -1,
        scale: +(0.92 + rng() * 0.14).toFixed(2),
        source: 'party_cutaway',
        sheetIdx: (i + 5) % 16,
        pose: ['dance', 'cup', 'cheer', 'lean'][i % 4],
        bobPhase: +(rng() * Math.PI * 2).toFixed(2),
      });
    }
  }
  return slots;
}

const rng = makeRng(19980914);
const placement = {
  _doc: 'G18 Night Party (100 people per venue): mixes Palm City 17 existing ped sheets + 32 top-down + 16 cutaway party variants. No house numbers.',
  trigger: { todMin: 0.72, radiusWu: 360, crowdCount: 100 },
  venues: {
    kosack: { name: "Kosack's House (Derby Dr — Basement + Backyard Pool)", heroBuildingId: 15666, world: [12576, -1474], slots: buildVenuePlacement('kosack', rng) },
    floyds: { name: "The Floyds' House (Hughes Ave — Paired Split-Foyer + Lawns)", heroBuildingId: 5313, world: [15744, 20573], slots: buildVenuePlacement('floyds', rng) },
  },
};
fs.writeFileSync(path.join(OUT, 'placement.json'), JSON.stringify(placement, null, 2));

// 1. Render Crowd Sprite Sheets & Props inside Chromium Canvas
const DRAW_SPRITES_JS = `
(() => {
  const INK = '#210f2e';
  const SKIN = ['#f3cbb4', '#e0a988', '#c68863', '#8c5a3e', '#f7dcc8'];
  const HAIR = ['#24171a', '#5a3a24', '#c99c4e', '#1a1a28', '#8a3424', '#d8b66c'];
  const TOPS = ['#ff4c6a', '#42b8e8', '#ffd24c', '#7a52ff', '#4ce08a', '#ff823a', '#f5f0e6', '#2b2d42', '#e85cb8', '#3ddad0', '#c43e38', '#8aa2b8'];
  const BOTTOMS = ['#283654', '#1d1c2b', '#765e46', '#3e4e3a', '#d8cbb4', '#4a2644'];
  const FLOATS = ['#ff4fa8', '#44e0ff', '#ffe04c', '#7cff66', '#ff8c3a'];

  // Sheet A: 32 top-down partygoers (640x320, 8x4 cells of 80x80; 0..23 yard/deck + 24..31 pool swimmers/floaties)
  window.bakeTopdownSheet = () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 320;
    const g = cv.getContext('2d');
    for (let i = 0; i < 32; i++) {
      const col = i % 8, row = Math.floor(i / 8), cx = col * 80 + 40, cy = row * 80 + 40;
      const sk = SKIN[i % SKIN.length], hr = HAIR[(i * 3) % HAIR.length], top = TOPS[(i * 5) % TOPS.length], bot = BOTTOMS[(i * 7) % BOTTOMS.length];
      const swimmer = i >= 24;
      g.save(); g.translate(cx, cy);
      if (swimmer) {
        // Pool ring floatie
        const fc = FLOATS[(i - 24) % FLOATS.length];
        g.strokeStyle = 'rgba(200,248,255,0.65)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.stroke();
        g.fillStyle = fc; g.beginPath(); g.arc(0, 0, 19, 0, Math.PI * 2); g.fill();
        g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
        g.fillStyle = '#2ea8d4'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        // Shoulders + head tilted back
        g.fillStyle = sk; g.beginPath(); g.ellipse(0, 2, 12, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = top; g.beginPath(); g.roundRect(-8, -3, 16, 8, 4); g.fill(); g.stroke();
        g.fillStyle = sk; g.beginPath(); g.arc(0, -5, 6.5, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = hr; g.beginPath(); g.arc(0, -6.5, 6.2, Math.PI, Math.PI * 2); g.fill(); g.stroke();
      } else {
        const pose = i % 3; // 0: holding red solo cup, 1: arms up dancing, 2: nodding chill
        // Soft drop shadow
        g.fillStyle = 'rgba(18,12,30,0.38)'; g.beginPath(); g.ellipse(3, 5, 16, 10, 0, 0, Math.PI * 2); g.fill();
        // Legs / sneakers stepping
        g.fillStyle = bot; g.strokeStyle = INK; g.lineWidth = 2;
        const step = pose === 1 ? 6 : 3;
        g.beginPath(); g.ellipse(-6, step, 5, 7, 0.2, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(6, -step, 5, 7, -0.2, 0, Math.PI * 2); g.fill(); g.stroke();
        // Torso / jacket / jersey shoulders
        g.fillStyle = top; g.beginPath(); g.ellipse(0, 0, 15, 9.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        // Stripe/cap detail for outfit variety
        if (i % 4 === 0) { g.fillStyle = '#ffffff'; g.fillRect(-10, -2, 20, 3); }
        // Arms + Red Solo Cup!
        if (pose === 0) {
          g.fillStyle = sk; g.beginPath(); g.arc(13, -7, 4.2, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = '#e82e38'; g.beginPath(); g.arc(15, -10, 4.4, 0, Math.PI * 2); g.fill(); g.stroke(); // solo cup rim!
          g.fillStyle = '#fff5ee'; g.beginPath(); g.arc(15, -10, 2.2, 0, Math.PI * 2); g.fill();
        } else if (pose === 1) {
          g.fillStyle = sk;
          g.beginPath(); g.arc(-14, -9, 4.2, 0, Math.PI * 2); g.fill(); g.stroke();
          g.beginPath(); g.arc(14, -9, 4.2, 0, Math.PI * 2); g.fill(); g.stroke();
        }
        // Head + hair + optional 90s backwards cap
        g.fillStyle = sk; g.beginPath(); g.arc(0, 0, 7.2, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = hr; g.beginPath(); g.arc(0, 1.5, 7.0, 0, Math.PI * 1.15); g.fill(); g.stroke();
        if (i % 5 === 1) {
          g.fillStyle = TOPS[(i + 2) % TOPS.length];
          g.beginPath(); g.arc(0, 0, 7.4, -0.4, Math.PI + 0.4); g.fill(); g.stroke();
          g.fillRect(-4, 5, 8, 5); g.strokeRect(-4, 5, 8, 5);
        }
      }
      g.restore();
    }
    return cv.toDataURL('image/png');
  };

  // Sheet B: 16 side-view cutaway partygoers (640x240, 8x2 cells of 80x120)
  window.bakeCutawaySheet = () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 240;
    const g = cv.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const col = i % 8, row = Math.floor(i / 8), cx = col * 80 + 40, base = row * 120 + 108;
      const sk = SKIN[i % SKIN.length], hr = HAIR[(i * 5) % HAIR.length], top = TOPS[(i * 3 + 1) % TOPS.length], bot = BOTTOMS[(i * 2 + 1) % BOTTOMS.length];
      const pose = i % 4; // 0: holding solo cup up, 1: dancing groove, 2: cheering both hands, 3: chill lean
      g.save(); g.translate(cx, base);
      g.lineWidth = 2.2; g.strokeStyle = INK;
      g.fillStyle = 'rgba(18,12,30,0.34)'; g.beginPath(); g.ellipse(0, 2, 16, 4.5, 0, 0, Math.PI * 2); g.fill();
      // Legs
      g.fillStyle = bot;
      const spread = pose === 1 ? 7 : 4;
      g.fillRect(-9, -38, 7, 34); g.strokeRect(-9, -38, 7, 34);
      g.fillRect(2 + (pose === 1 ? 2 : 0), -38, 7, 34); g.strokeRect(2 + (pose === 1 ? 2 : 0), -38, 7, 34);
      // Sneakers
      g.fillStyle = '#f2efe8';
      g.beginPath(); g.roundRect(-11, -6, 10, 6, 2); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(1 + (pose === 1 ? 2 : 0), -6, 10, 6, 2); g.fill(); g.stroke();
      // Torso
      const lean = pose === 3 ? -2 : 0;
      g.fillStyle = top; g.beginPath(); g.roundRect(-11 + lean, -74, 22, 38, 6); g.fill(); g.stroke();
      // Head & Hair
      g.fillStyle = sk; g.beginPath(); g.arc(lean, -86, 10.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = hr; g.beginPath(); g.arc(lean - 1, -90, 10.5, Math.PI * 0.85, Math.PI * 2.15); g.fill(); g.stroke();
      // Arms + Red Solo Cup
      g.strokeStyle = sk; g.lineWidth = 5.5; g.lineCap = 'round';
      if (pose === 0 || pose === 3) {
        g.beginPath(); g.moveTo(8 + lean, -68); g.lineTo(18, -58); g.stroke();
        g.fillStyle = '#e82e38'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(14, -67); g.lineTo(22, -67); g.lineTo(20.5, -56); g.lineTo(15.5, -56); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#ffffff'; g.fillRect(14, -68, 8, 2);
      } else if (pose === 2) {
        g.beginPath(); g.moveTo(-9, -68); g.lineTo(-18, -88); g.moveTo(9, -68); g.lineTo(18, -88); g.stroke();
      } else {
        g.beginPath(); g.moveTo(-9, -68); g.lineTo(-16, -54); g.moveTo(9, -68); g.lineTo(17, -62); g.stroke();
      }
      g.restore();
    }
    return cv.toDataURL('image/png');
  };

  // Sheet C: Party props sheet (512x256, 3x2 grid)
  window.bakePropsSheet = () => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    const drawBox = (x, y, w, h, f) => { g.fillStyle = f; g.beginPath(); g.roundRect(x, y, w, h, 4); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke(); };
    // Cell (0,0): String light festoon strand
    g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(16, 32); g.quadraticCurveTo(85, 84, 154, 32); g.stroke();
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7, bx = 16 + 138 * t, by = 32 + 52 * Math.sin(t * Math.PI) * 0.9;
      const gl = g.createRadialGradient(bx, by, 1, bx, by, 18); gl.addColorStop(0, 'rgba(255,214,120,0.85)'); gl.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(bx, by, 18, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(bx, by, 4.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // Cell (1,0): Beer-pong table w/ solo triangles
    drawBox(186, 32, 140, 64, '#e8e2d2');
    g.strokeStyle = '#3c80d6'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(256, 34); g.lineTo(256, 94); g.stroke();
    for (const [bx, dir] of [[202, 1], [310, -1]]) {
      for (const [dx, dy] of [[0, 0], [dir * 9, -6], [dir * 9, 6], [dir * 18, -11], [dir * 18, 0], [dir * 18, 11]]) {
        g.fillStyle = '#e82e38'; g.beginPath(); g.arc(bx + dx, 64 + dy, 4.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
      }
    }
    // Cell (2,0): Ice keg tub
    g.fillStyle = '#3278b8'; g.beginPath(); g.arc(426, 64, 34, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.8; g.stroke();
    g.fillStyle = '#c8f0ff'; g.beginPath(); g.arc(426, 64, 24, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#d4dae2'; g.beginPath(); g.arc(426, 64, 16, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#262432'; g.fillRect(422, 40, 8, 22);
    // Cell (0,1): Boombox + Bass Ring
    g.strokeStyle = 'rgba(110,226,255,0.75)'; g.lineWidth = 3; g.beginPath(); g.arc(85, 192, 46, 0, Math.PI * 2); g.stroke();
    drawBox(38, 168, 94, 48, '#2b2438');
    for (const sx of [62, 108]) { g.fillStyle = '#4e4862'; g.beginPath(); g.arc(sx, 192, 15, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ffd24c'; g.lineWidth = 2; g.stroke(); }
    // Cell (1,1): Red solo cup scatter cluster
    for (const [ox, oy] of [[-26, -12], [-8, 14], [18, -8], [28, 16], [2, -2]]) {
      g.fillStyle = '#e82e38'; g.beginPath(); g.arc(256 + ox, 192 + oy, 8, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff5ee'; g.beginPath(); g.arc(256 + ox, 192 + oy, 4, 0, Math.PI * 2); g.fill();
    }
    // Cell (2,1): Neon Pool Floatie
    g.fillStyle = '#ff4fa8'; g.beginPath(); g.arc(426, 192, 34, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.8; g.stroke();
    g.fillStyle = '#2ea8d4'; g.beginPath(); g.arc(426, 192, 14, 0, Math.PI * 2); g.fill(); g.stroke();
    return cv.toDataURL('image/png');
  };
})();
`;

const sp = await browser.newPage();
await sp.setContent('<html><body></body></html>');
await sp.addScriptTag({ content: DRAW_SPRITES_JS });
for (const [fn, pngName, webpName] of [
  ['bakeTopdownSheet', 'party_crowd_topdown.png', 'party_crowd_topdown.webp'],
  ['bakeCutawaySheet', 'party_crowd_cutaway.png', 'party_crowd_cutaway.webp'],
  ['bakePropsSheet', 'party_props_sheet.png', 'party_props_sheet.webp'],
]) {
  const url = await sp.evaluate((f) => window[f](), fn);
  const p = path.join(TMP, pngName);
  fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', '-alpha_q', '100', p, '-o', path.join(SPR_OUT, webpName)]);
}
await sp.close();

// 2. Capture Contact Sheet for Sprite Pack
const tb64 = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(TMP, n)).toString('base64');
const cs = await browser.newPage({ viewport: { width: 1200, height: 1050 }, deviceScaleFactor: 1 });
await cs.setContent(`
  <html><body style="margin:0;background:#160b24;color:#fff4de;font-family:'Avenir Next',system-ui,sans-serif;padding:20px;">
    <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:6px;">
      TASK G18 — NIGHT PARTY CROWD & DRESSING ASSET PACK (#210f2e INK)
    </div>
    <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:16px;">
      32 Top-Down Partygoers (640×320) · 16 Cutaway Guests (640×240) · 6 Props (512×256) + 17 Palm City Ped Sheets Mixed
    </div>
    <div style="display:grid;grid-template-columns:1fr;gap:14px;">
      <div style="background:#241438;border:2px solid #523a68;border-radius:10px;padding:12px;">
        <div style="font-weight:800;font-size:13px;color:#7dffa8;margin-bottom:8px;">party_crowd_topdown.webp (640×320 — Lawn/Deck w/ Solo Cups & Pool Swimmers)</div>
        <img src="${tb64('party_crowd_topdown.png')}" style="width:100%;max-width:860px;background:#3a4a3a;border-radius:8px;display:block;margin:auto;"/>
      </div>
      <div style="display:flex;gap:14px;">
        <div style="flex:1;background:#241438;border:2px solid #523a68;border-radius:10px;padding:12px;">
          <div style="font-weight:800;font-size:13px;color:#ffb4a2;margin-bottom:8px;">party_crowd_cutaway.webp (640×240 — Basement & Split-Foyer)</div>
          <img src="${tb64('party_crowd_cutaway.png')}" style="width:100%;background:#6e5a4c;border-radius:8px;display:block;"/>
        </div>
        <div style="flex:1;background:#241438;border:2px solid #523a68;border-radius:10px;padding:12px;">
          <div style="font-weight:800;font-size:13px;color:#ffd45c;margin-bottom:8px;">party_props_sheet.webp (512×256 — Festoons, Pong Table, Keg, Boombox, Float)</div>
          <img src="${tb64('party_props_sheet.png')}" style="width:100%;background:#2b3d30;border-radius:8px;display:block;"/>
        </div>
      </div>
    </div>
  </body></html>
`);
await cs.waitForTimeout(300);
await cs.screenshot({ path: path.join(OUT, 'g18-crowd-contact-sheet.png'), fullPage: true });
await cs.close();

// 3. Capture REAL night backdrops at Kosack [12576,-1474] and Floyds [15744,20573] (t=0.90) + Bradley cutaway reference
const VENUE_CAMS = [
  ['kosack', 12576, -1530, 0.72],
  ['floyds', 15810, 20580, 0.64],
];
const pBg = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
for (const [slug, cx, cy, z] of VENUE_CAMS) {
  await pBg.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=${cx},${cy},${z}&t=0.90`);
  await pBg.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes && window.__lf.areas.heroes.length >= 10, null, { timeout: 180000 });
  await pBg.waitForFunction(({ cx, cy, z }) => {
    const g = window.__lf.ground, CH = 256, hw = 210 / z, hh = 430 / z;
    for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
      for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
        const c = g.cache.get(gx + ',' + gy);
        if (!c) return false;
        const st = g.painted ? g.paintedState(gx, gy) : null;
        if (st === 'loading') return false;
        if (st === 'ok' && !c._pt) return false;
      }
    return true;
  }, { cx, cy, z }, { timeout: 180000 });
  await pBg.waitForTimeout(650);
  await pBg.screenshot({ path: path.join(TMP, `bg-${slug}.png`) });
}
await pBg.close();

// 4. Composite 420x860 @2x Phone Night-Party Mockups for both 100-person Venues
const RENDER_MOCKUP_JS = `
window.drawPartyVenue = async (venueKey, slots, bgSrc, tdSrc, cutSrc, propsSrc, cxCam, cyCam, zoom) => {
  const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = s; });
  const [bg, tdImg, cutImg, propsImg] = await Promise.all([load(bgSrc), load(tdSrc), load(cutSrc), load(propsSrc)]);
  const cv = document.createElement('canvas'); cv.width = 420; cv.height = 860;
  const g = cv.getContext('2d');
  const INK = '#210f2e';
  g.drawImage(bg, 0, 0, 420, 860);

  // World-to-screen transform for this venue (aligned cleanly to house centers & camera)
  const wToS = (u, v) => {
    const x = 210 + (u) * zoom, y = (venueKey === 'kosack' ? 405 : 395) + (v) * zoom;
    return [x, y];
  };

  // Lighting pass: warm patio/pool/driveway washes + bass rings piercing the blue dusk
  g.save(); g.globalCompositeOperation = 'lighter';
  const washes = venueKey === 'kosack'
    ? [[-10, -86, 110, 'rgba(60,210,255,0.42)'], [8, 44, 130, 'rgba(255,196,96,0.34)'], [-30, -110, 120, 'rgba(255,180,85,0.28)']]
    : [[52, -10, 145, 'rgba(255,198,96,0.34)'], [-24, 86, 115, 'rgba(255,172,78,0.28)'], [108, 72, 105, 'rgba(130,196,255,0.28)']];
  for (const [u, v, rad, col] of washes) {
    const [sx, sy] = wToS(u, v), sr = rad * zoom;
    const rg = g.createRadialGradient(sx, sy, 2, sx, sy, sr);
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  // String lights festoons
  for (const [u0, v0, u1, v1] of venueKey === 'kosack'
    ? [[-56, -124, 48, -120], [-56, -54, 48, -54], [-18, 22, 54, 88]]
    : [[-48, 28, 152, 28], [-32, -68, 136, -68], [18, -28, 86, 48]]) {
    const [x0, y0] = wToS(u0, v0), [x1, y1] = wToS(u1, v1);
    g.strokeStyle = 'rgba(33,15,46,0.7)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 12, x1, y1); g.stroke();
    for (let k = 0; k < 8; k++) {
      const t = (k + 0.5) / 8, bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 9;
      g.fillStyle = k % 2 ? '#ffe38c' : '#ff9852';
      g.beginPath(); g.arc(bx, by, 2.2, 0, Math.PI * 2); g.fill();
    }
  }

  // Props (beer pong table, keg, boombox w/ bass rings)
  const drawPropCell = (col, row, u, v, sc = 0.24) => {
    const [sx, sy] = wToS(u, v), cw = propsImg.width / 3, ch = propsImg.height / 2;
    g.drawImage(propsImg, col * cw, row * ch, cw, ch, sx - cw * sc / 2, sy - ch * sc / 2, cw * sc, ch * sc);
  };
  if (venueKey === 'kosack') {
    drawPropCell(1, 0, -52, -78, 0.22); // pong table
    drawPropCell(2, 0, 38, -88, 0.16);  // keg
    drawPropCell(0, 1, -24, -48, 0.16); // boombox
  } else {
    drawPropCell(1, 0, 52, 22, 0.22);
    drawPropCell(2, 0, 88, -68, 0.16);
    drawPropCell(0, 1, -18, 66, 0.16);
  }

  // Expanding bass rings radiating from the party
  for (const r of [52, 86, 124]) {
    const [bx, by] = wToS(venueKey === 'kosack' ? 0 : 44, venueKey === 'kosack' ? -50 : 10);
    g.strokeStyle = 'rgba(110,226,255,0.28)'; g.lineWidth = 1.8;
    g.beginPath(); g.arc(bx, by, r * zoom, 0, Math.PI * 2); g.stroke();
  }

  // Outdoor Partygoers (~62 / ~54 slots drawn cleanly from sprite sheets — ZERO clones)
  for (const s of slots.filter(q => q.layer === 'outdoor')) {
    const [sx, sy] = wToS(s.u, s.v);
    const idx = s.sheetIdx % 32, c = idx % 8, r = Math.floor(idx / 8);
    const sz = 20 * s.scale * zoom;
    g.drawImage(tdImg, c * 80, r * 80, 80, 80, sx - sz / 2, sy - sz / 2, sz, sz);
  }

  // Lower Inset Box: Basement / Split-Foyer Indoor View of the rest of the 100-person crowd
  const ix = 16, iy = 568, iw = 388, ih = 250;
  g.fillStyle = '#1b122b'; g.beginPath(); g.roundRect(ix, iy, iw, ih, 14); g.fill();
  g.strokeStyle = '#ffd45c'; g.lineWidth = 2.4; g.stroke();
  g.save(); g.beginPath(); g.roundRect(ix + 3, iy + 28, iw - 6, ih - 31, 10); g.clip();
  // Indoor wood paneling + warm fireplace/bass lamp glow
  g.fillStyle = '#5e4234'; g.fillRect(ix, iy + 28, iw, ih);
  g.strokeStyle = 'rgba(30,18,12,0.35)'; g.lineWidth = 1.5;
  for (let x = ix; x < ix + iw; x += 14) { g.beginPath(); g.moveTo(x, iy + 28); g.lineTo(x, iy + ih); g.stroke(); }
  if (venueKey === 'floyds') {
    // Split-foyer floor divider line
    g.fillStyle = '#332026'; g.fillRect(ix, iy + 132, iw, 10);
    g.fillStyle = '#d9c79c'; g.fillRect(ix, iy + 28, iw, 104); // upstairs wall
  }
  const ig = g.createRadialGradient(ix + iw / 2, iy + ih - 55, 6, ix + iw / 2, iy + ih - 55, 190);
  ig.addColorStop(0, 'rgba(255,168,72,0.45)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = ig; g.fillRect(ix, iy + 28, iw, ih);
  // Draw ALL indoor cutaway guests!
  for (const s of slots.filter(q => q.layer === 'indoor')) {
    const px = ix + 18 + (s.x / 12) * (iw - 36);
    const py = venueKey === 'floyds' && s.floor === 'main' ? iy + 132 : iy + ih - 8;
    const c = s.sheetIdx % 8, r = Math.floor((s.sheetIdx % 16) / 8);
    g.save(); g.translate(px, py); if (s.facing < 0) g.scale(-1, 1);
    g.drawImage(cutImg, c * 80, r * 120, 80, 120, -26 * s.scale, -74 * s.scale, 52 * s.scale, 76 * s.scale);
    g.restore();
  }
  g.restore();
  g.fillStyle = 'rgba(27,20,48,0.92)'; g.beginPath(); g.roundRect(ix + 10, iy + 6, iw - 20, 22, 8); g.fill();
  g.fillStyle = '#ffd45c'; g.font = '800 11px system-ui'; g.textAlign = 'center';
  const inCt = slots.filter(q => q.layer === 'indoor').length, outCt = slots.filter(q => q.layer === 'outdoor').length;
  g.fillText(venueKey === 'kosack' ? \`KOSACK BASEMENT CUTAWAY (\${inCt} INSIDE · \${outCt} BY POOL/LAWN)\` : \`FLOYDS SPLIT-FOYER CUTAWAY (\${inCt} INSIDE · \${outCt} OUTDOORS)\`, ix + iw / 2, iy + 21);

  // Top Night Party HUD Pill
  g.fillStyle = 'rgba(27,20,48,0.9)'; g.beginPath(); g.roundRect(14, 72, 286, 30, 12); g.fill();
  g.strokeStyle = '#ff6ec7'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#ffd45c'; g.font = '900 12px system-ui'; g.textAlign = 'left';
  g.fillText(\`NIGHT PARTY · 100 GUESTS (\${venueKey === 'kosack' ? 'KOSACK' : 'FLOYDS'})\`, 24, 91);
  return cv.toDataURL('image/png');
};
`;

const mp = await browser.newPage();
await mp.setContent('<html><body></body></html>');
await mp.addScriptTag({ content: RENDER_MOCKUP_JS });

const shotsMeta = [
  ['kosack', 12576, -1530, 0.72, 'Venue A: Kosack Basement + Backyard Pool (100 People)'],
  ['floyds', 15810, 20580, 0.64, 'Venue B: The Floyds Split-Foyer Pair + Lawns (100 People)'],
];
const tdUrl = tb64('party_crowd_topdown.png');
const cutUrl = tb64('party_crowd_cutaway.png');
const prpUrl = tb64('party_props_sheet.png');

for (const [slug, cx, cy, z] of shotsMeta) {
  const bgUrl = 'data:image/png;base64,' + fs.readFileSync(path.join(TMP, `bg-${slug}.png`)).toString('base64');
  const slots = placement.venues[slug].slots;
  const url = await mp.evaluate(
    ({ slug, slots, bgUrl, tdUrl, cutUrl, prpUrl, cx, cy, z }) => window.drawPartyVenue(slug, slots, bgUrl, tdUrl, cutUrl, prpUrl, cx, cy, z),
    { slug, slots, bgUrl, tdUrl, cutUrl, prpUrl, cx, cy, z }
  );
  fs.writeFileSync(path.join(TMP, `party-${slug}.png`), Buffer.from(url.split(',')[1], 'base64'));
}
await mp.close();

// 5. Side-by-side 420x860 Phone Composite Sheet
const phoneComp = await browser.newPage({ viewport: { width: 920, height: 960 }, deviceScaleFactor: 1 });
await phoneComp.setContent(`
  <html><body style="margin:0;background:#160b24;color:#fff4de;font-family:'Avenir Next',system-ui,sans-serif;padding:18px;">
    <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:6px;">
      TASK G18 — THE NIGHT PARTY (100 GUESTS AT KOSACK'S OR THE FLOYDS', t=0.90)
    </div>
    <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:14px;">
      Zero Clones (17 Ped Sheets + 32 Top-Down + 16 Cutaway Variants) · Night Pool Glow + String Lights + Bass Rings
    </div>
    <div style="display:flex;gap:16px;justify-content:center;">
      ${shotsMeta.map(([slug, , , , lbl]) => `
        <div style="text-align:center;width:420px;">
          <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:6px;">${lbl}</div>
          <img src="${tb64(`party-${slug}.png`)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
        </div>
      `).join('')}
    </div>
  </body></html>
`);
await phoneComp.waitForTimeout(300);
await phoneComp.screenshot({ path: path.join(OUT, 'g18-night-party-phone.png'), fullPage: true });
await phoneComp.close();

await browser.close();
web.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('G18 NIGHT PARTY ASSETS & MOCKUPS COMPLETE');
