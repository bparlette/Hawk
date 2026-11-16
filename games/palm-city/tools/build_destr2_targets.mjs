// build_destr2_targets.mjs — generate Destruction Phase 2 4-stage look targets
// Usage: CHROME=/path/to/chrome node tools/build_destr2_targets.mjs
// Outputs: shots/destruction2-target-buildings.png, shots/destruction2-target-street.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots');
const EVT = path.join(OUT, 'events-sprites');
const ASSETS = path.join(ROOT, 'assets');

const loadB64 = (p) => 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64');
const refs = {
  hydIntact: loadB64(path.join(EVT, 'anchor_hydrant_intact.webp')),
  hydGeyser: loadB64(path.join(EVT, 'anchor_hydrant_geyser.webp')),
  shops: loadB64(path.join(ASSETS, 'bld_shops.webp')),
  diner: loadB64(path.join(ASSETS, 'bld_diner.webp')),
};

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1080 } });

await page.setContent(`<body style="margin:0;background:#1e1629;"><canvas id="c" width="1280" height="900"></canvas><script>
const INK = '#210f2e';
function drawGrid(ctx, W, H, title, colHeaders, rowLabels) {
  ctx.fillStyle = '#bc8d5b'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#20182a'; ctx.fillRect(0, 0, W, 62);
  ctx.font = 'bold 20px monospace'; ctx.fillStyle = '#ffe58f'; ctx.fillText(title, 18, 26);
  const labelW = 200, colW = (W - labelW) / 4;
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#f2edf7';
  colHeaders.forEach((h, i) => ctx.fillText(h, labelW + i * colW + 14, 50));
  const rowH = (H - 62) / rowLabels.length;
  ctx.strokeStyle = '#7c5a3c'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    const x = i === 0 ? labelW : labelW + i * colW;
    ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x, H); ctx.stroke();
  }
  rowLabels.forEach((lbl, r) => {
    const y = 62 + r * rowH;
    if (r > 0) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#1f1428';
    lbl.forEach((line, li) => ctx.fillText(line, 18, y + rowH / 2 - (lbl.length - 1) * 9 + li * 19));
  });
  return { labelW, colW, rowH, top: 62 };
}

function inkRect(ctx, x, y, w, h, fill, lw = 2.4) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h);
}

function drawShards(ctx, cx, cy, count, col, sz = 6, seed = 1) {
  for (let i = 0; i < count; i++) {
    const a = (i * 2.3999 + seed) % (Math.PI * 2);
    const d = 8 + ((i * 19 + seed * 7) % 34);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.65); ctx.rotate(a + i * 0.5);
    ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.35); ctx.lineTo(sz * 0.8, 0); ctx.lineTo(-sz * 0.3, sz * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

window.renderBuildingsSheet = async () => {
  const c = document.getElementById('c'); c.width = 1280; c.height = 760;
  const g = c.getContext('2d');
  const grid = drawGrid(g, 1280, 760,
    'PALM CITY DESTRUCTION PHASE 2 - BUILDING FRONTS',
    ['0. INTACT', '1. SCUFF / BEND / TILT', '2. CRACK / TEAR / HANG', '3. SHATTERED / FALLEN'],
    [['storefront glass', '(diner / shops)'], ['striped awning', '(shops / cafe)'], ['rooftop signage', '(NOVA / DINER / MOTEL)']]
  );
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 0.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#cfbeaa'; g.fillRect(-98, 2, 196, 56);
    g.strokeStyle = '#998774'; g.lineWidth = 1.4; g.strokeRect(-98, 2, 196, 56);
    inkRect(g, -92, -56, 184, 38, '#d98b6c', 2.6);
    inkRect(g, -88, -18, 176, 26, s === 3 ? '#181224' : '#7ac9e8', 2.6);
    const paneX = [-88, -29, 30, 88];
    if (s < 3) {
      g.fillStyle = 'rgba(255,255,255,0.42)';
      for (let p = 0; p < 3; p++) {
        g.beginPath(); g.moveTo(paneX[p] + 6, -15); g.lineTo(paneX[p] + 18, -15);
        g.lineTo(paneX[p] + 8, 5); g.lineTo(paneX[p] + 2, 5); g.closePath(); g.fill();
      }
      g.strokeStyle = '#4f3a36'; g.lineWidth = 3;
      for (const mx of [-29, 30]) { g.beginPath(); g.moveTo(mx, -18); g.lineTo(mx, 8); g.stroke(); }
    }
    if (s === 1) {
      g.strokeStyle = '#33293a'; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(-22, -6); g.quadraticCurveTo(2, 2, 26, -8); g.stroke();
      g.strokeStyle = '#f2fbff'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(10, -16); g.lineTo(2, -4); g.lineTo(14, 5); g.stroke();
    } else if (s === 2) {
      g.strokeStyle = '#eefaff'; g.lineWidth = 1.7;
      for (const [x0, y0] of [[-12, -6], [48, -5]]) for (let r = 0; r < 7; r++) {
        const ang = r * 0.9; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(ang) * 16, y0 + Math.sin(ang) * 10); g.stroke();
      }
      drawShards(g, 18, 22, 5, '#cbeeff', 4.5, 2);
    } else if (s === 3) {
      g.fillStyle = '#dff6ff'; g.strokeStyle = INK; g.lineWidth = 1.4;
      for (const tx of [-74, -56, -24, 18, 42, 72]) {
        g.beginPath(); g.moveTo(tx - 6, -17); g.lineTo(tx, -8); g.lineTo(tx + 5, -17); g.closePath(); g.fill(); g.stroke();
      }
      g.save(); g.translate(-12, 26); g.rotate(0.28); inkRect(g, -18, -2.5, 36, 5, '#59423d', 1.8); g.restore();
      drawShards(g, 8, 26, 13, '#bfeaff', 5.2, 5);
    }
    g.restore();
  }
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 1.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    inkRect(g, -92, -52, 184, 30, '#e3be92', 2.6);
    if (s === 0) {
      g.fillStyle = 'rgba(33,15,46,0.22)'; g.fillRect(-86, -16, 178, 44);
      for (let k = 0; k < 8; k++) inkRect(g, -88 + k * 22, -22, 22, 42, k % 2 === 0 ? '#e65b65' : '#fff2dc', 2.0);
      g.strokeStyle = INK; g.lineWidth = 2.6; g.strokeRect(-88, -22, 176, 42);
    } else if (s === 1) {
      g.fillStyle = 'rgba(33,15,46,0.22)';
      g.beginPath(); g.moveTo(-88, -16); g.quadraticCurveTo(0, -4, 88, -16); g.lineTo(88, 26); g.quadraticCurveTo(0, 14, -88, 26); g.fill();
      for (let k = 0; k < 8; k++) {
        const x = -88 + k * 22, dip = Math.sin(((k + 0.5) / 8) * Math.PI) * 10;
        g.fillStyle = k % 2 === 0 ? '#e65b65' : '#fff2dc';
        g.beginPath(); g.moveTo(x, -22); g.lineTo(x + 22, -22); g.lineTo(x + 22, 20 - dip); g.lineTo(x, 20 - dip * 0.9);
        g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      }
      g.strokeStyle = '#3c2539'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-24, -6); g.lineTo(18, 2); g.stroke();
    } else if (s === 2) {
      g.strokeStyle = '#5f687a'; g.lineWidth = 3;
      for (const rx of [22, 54, 82]) { g.beginPath(); g.moveTo(rx, -22); g.lineTo(rx - 6, 14); g.stroke(); }
      for (let k = 0; k < 4; k++) inkRect(g, -88 + k * 22, -22, 22, 40, k % 2 === 0 ? '#e65b65' : '#fff2dc', 2.0);
      g.save(); g.translate(10, 4); g.rotate(0.45);
      for (let k = 0; k < 3; k++) inkRect(g, k * 20, 0, 20, 32, k % 2 === 0 ? '#fff2dc' : '#e65b65', 2.0);
      g.restore();
    } else {
      g.strokeStyle = '#535b6b'; g.lineWidth = 3.2;
      for (const rx of [-72, -26, 26, 72]) { g.beginPath(); g.moveTo(rx, -22); g.lineTo(rx + (rx > 0 ? -10 : 8), -4); g.stroke(); }
      drawShards(g, -20, 22, 4, '#e65b65', 11, 1); drawShards(g, 26, 24, 4, '#fff2dc', 10, 3);
    }
    g.restore();
  }
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 2.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    inkRect(g, -92, -48, 184, 34, '#8d5b74', 2.6);
    const drawSign = (ang, ox, oy, cracked) => {
      g.save(); g.translate(ox, oy); g.rotate(ang);
      g.fillStyle = 'rgba(33,15,46,0.28)'; g.fillRect(-52, 6, 108, 28);
      inkRect(g, -54, -14, 108, 32, '#2d1c3d', 2.6);
      g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = cracked >= 3 ? '#6d4b6e' : '#ff4fc3';
      g.fillText(cracked >= 2 ? 'NO  A' : 'NOVA', 0, 3);
      if (cracked >= 1 && cracked < 3) { g.strokeStyle = '#ffdf78'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, -8); g.lineTo(20, 12); g.stroke(); }
      g.restore();
    };
    if (s === 0) drawSign(0, 0, -24, 0);
    else if (s === 1) { g.strokeStyle = '#474f5e'; g.lineWidth = 3; g.beginPath(); g.moveTo(-42, -32); g.lineTo(-48, -14); g.stroke(); drawSign(0.24, 2, -20, 1); }
    else if (s === 2) { g.strokeStyle = '#ffe56b'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, -24); g.quadraticCurveTo(-24, -4, -18, 8); g.stroke(); drawSign(-0.62, 14, 8, 2); }
    else { drawSign(0.18, 6, 26, 3); drawShards(g, -22, 34, 7, '#ff7cd5', 4.5, 4); inkRect(g, -42, -34, 8, 8, '#4a4152', 1.8); inkRect(g, 34, -34, 8, 8, '#4a4152', 1.8); }
    g.restore();
  }
  return c.toDataURL('image/png');
};

window.renderStreetSheet = async (refs) => {
  const hyd0 = new Image(); hyd0.src = refs.hydIntact; await new Promise(r => hyd0.onload = r);
  const hydG = new Image(); hydG.src = refs.hydGeyser; await new Promise(r => hydG.onload = r);
  const c = document.getElementById('c'); c.width = 1280; c.height = 960;
  const g = c.getContext('2d');
  const grid = drawGrid(g, 1280, 960,
    'PALM CITY DESTRUCTION PHASE 2 - FENCES, HYDRANTS & STALLS',
    ['0. INTACT', '1. BENT / LEAKING', '2. BREACHED / GEYSER', '3. CRUSHED / DEBRIS'],
    [['picket yard fence', '(houses / villas)'], ['chain-link fence', '(motel / garage lot)'], ['fire hydrant', '(corner curb)'], ['market stall', '(boardwalk / plaza)']]
  );
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 0.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#5e8f48'; g.fillRect(-98, -56, 196, 56);
    g.fillStyle = '#c9b7a2'; g.fillRect(-98, 0, 196, 56);
    if (s === 0) { inkRect(g, -88, -5, 176, 8, '#f6efe6', 2.2); for (let x = -84; x <= 84; x += 28) inkRect(g, x - 5, -10, 10, 18, '#fffaf2', 2.2); }
    else if (s === 1) {
      g.strokeStyle = INK; g.lineWidth = 2.2; g.fillStyle = '#f6efe6';
      g.beginPath(); g.moveTo(-88, -5); g.quadraticCurveTo(0, -14, 88, -5); g.lineTo(88, 3); g.quadraticCurveTo(0, -6, -88, 3); g.closePath(); g.fill(); g.stroke();
      for (const x of [-84, -56, 56, 84]) inkRect(g, x - 5, -10, 10, 18, '#fffaf2', 2.2);
      g.save(); g.translate(0, -8); g.rotate(0.26); inkRect(g, -6, -10, 12, 20, '#efe2d3', 2.2); g.restore();
    } else if (s === 2) {
      for (const x of [-84, -56, 56, 84]) inkRect(g, x - 5, -10, 10, 18, '#fffaf2', 2.2);
      g.save(); g.translate(-68, 0); g.rotate(-0.18); inkRect(g, -20, -4, 40, 8, '#f6efe6', 2); g.restore();
      g.save(); g.translate(68, 0); g.rotate(0.22); inkRect(g, -20, -4, 40, 8, '#f6efe6', 2); g.restore();
      drawShards(g, 0, 16, 7, '#f6efe6', 7, 2);
    } else {
      for (const x of [-84, -28, 28, 84]) inkRect(g, x - 4, -4, 8, 8, '#ccbda9', 2);
      drawShards(g, 0, 12, 10, '#f3eadf', 8, 6);
    }
    g.restore();
  }
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 1.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#524b5d'; g.fillRect(-98, -56, 196, 112);
    if (s === 0) { inkRect(g, -88, -4, 176, 6, '#9ca8ba', 2); for (const x of [-84, -28, 28, 84]) inkRect(g, x - 4, -8, 8, 14, '#798598', 2); }
    else if (s === 1) {
      g.strokeStyle = INK; g.lineWidth = 2; g.fillStyle = '#9ca8ba';
      g.beginPath(); g.moveTo(-88, -4); g.quadraticCurveTo(0, -18, 88, -4); g.lineTo(88, 2); g.quadraticCurveTo(0, -12, -88, 2); g.closePath(); g.fill(); g.stroke();
      for (const x of [-84, 84]) inkRect(g, x - 4, -8, 8, 14, '#798598', 2);
      inkRect(g, -4, -18, 8, 14, '#798598', 2);
    } else if (s === 2) {
      for (const x of [-84, 84]) inkRect(g, x - 4, -8, 8, 14, '#798598', 2);
      g.save(); g.translate(-52, 6); g.rotate(0.42); inkRect(g, -30, -3, 60, 6, '#9ca8ba', 2); g.restore();
      g.save(); g.translate(52, -10); g.rotate(-0.38); inkRect(g, -30, -3, 60, 6, '#9ca8ba', 2); g.restore();
      inkRect(g, -3, 18, 6, 6, '#5c6678', 1.6);
    } else {
      for (const x of [-84, -28, 28, 84]) inkRect(g, x - 3, -3, 6, 6, '#5c6678', 1.8);
      drawShards(g, 0, 8, 8, '#95a1b4', 9, 4);
    }
    g.restore();
  }
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 2.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#cab7a3'; g.fillRect(-98, -56, 196, 112);
    if (s === 0) g.drawImage(hyd0, -36, -36, 72, 72);
    else if (s === 1) {
      g.fillStyle = 'rgba(110,208,245,0.42)'; g.beginPath(); g.ellipse(8, 10, 26, 16, 0.2, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(4, -2); g.rotate(0.32); g.drawImage(hyd0, -34, -34, 68, 68); g.restore();
      g.strokeStyle = '#d8f6ff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(12, -8); g.lineTo(28, -16); g.moveTo(14, -4); g.lineTo(32, -2); g.stroke();
    } else if (s === 2) {
      g.fillStyle = 'rgba(92,196,242,0.48)'; g.beginPath(); g.ellipse(0, 14, 52, 30, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(hydG, -52, -52, 104, 104);
    } else {
      g.fillStyle = 'rgba(84,182,232,0.52)'; g.beginPath(); g.ellipse(0, 4, 58, 34, -0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#dff7ff'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 1.6); g.stroke();
      inkRect(g, -9, -9, 18, 18, '#7a252a', 2.2);
      g.save(); g.translate(38, 18); g.rotate(0.8); inkRect(g, -11, -7, 22, 14, '#e0423f', 2); g.restore();
    }
    g.restore();
  }
  for (let s = 0; s < 4; s++) {
    const cx = grid.labelW + (s + 0.5) * grid.colW, cy = grid.top + 3.5 * grid.rowH;
    g.save(); g.translate(cx, cy);
    g.fillStyle = '#d3b896'; g.fillRect(-98, -56, 196, 112);
    const drawCanopy = (x, y, rot, squashY, torn) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, squashY);
      g.fillStyle = 'rgba(33,15,46,0.22)'; g.fillRect(-44, -26, 92, 58);
      for (let k = 0; k < 5; k++) if (!(torn && k === 3)) inkRect(g, -45 + k * 18, -28, 18, 56, k % 2 === 0 ? '#2fa8b8' : '#fff5df', 2.0);
      g.restore();
    };
    if (s === 0) { inkRect(g, -40, 26, 80, 14, '#b87f4d', 2.0); drawCanopy(0, -4, 0, 1, false); }
    else if (s === 1) { inkRect(g, -38, 28, 76, 14, '#b87f4d', 2.0); drawCanopy(4, -4, 0.20, 0.92, false); drawShards(g, -36, 36, 4, '#ff7f45', 4.5, 1); }
    else if (s === 2) { drawShards(g, 18, 26, 5, '#b87f4d', 8, 3); drawCanopy(-8, 2, -0.34, 0.68, true); drawShards(g, 34, -12, 5, '#ffbb3b', 4, 7); }
    else { drawShards(g, -18, 8, 6, '#b87f4d', 9, 2); drawShards(g, 12, 4, 5, '#2fa8b8', 11, 5); drawShards(g, -6, 18, 4, '#fff5df', 10, 8); }
    g.restore();
  }
  return c.toDataURL('image/png');
};
</script></body>`);

fs.writeFileSync(path.join(OUT, 'destruction2-target-buildings.png'), Buffer.from((await page.evaluate(() => window.renderBuildingsSheet())).split(',')[1], 'base64'));
fs.writeFileSync(path.join(OUT, 'destruction2-target-street.png'), Buffer.from((await page.evaluate((r) => window.renderStreetSheet(r), refs)).split(',')[1], 'base64'));
await browser.close();
console.log('Wrote destruction2 targets to', OUT);
