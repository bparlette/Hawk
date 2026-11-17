// build_destr2_sprites.mjs — generate 28 transparent game-scale Destruction Phase 2 WebP sprites
// Usage: CHROME=/path/to/chrome node tools/build_destr2_sprites.mjs
// Output: shots/destruction2-sprites/*.webp (2 px per world unit, UPM=10)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'destruction2-sprites');
const EVT = path.join(ROOT, 'shots', 'events-sprites');
const TMP = '/tmp/build_destr2_png';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const cwebp = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
const loadW = (p) => 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64');
const refs = {
  hyd0: loadW(path.join(EVT, 'anchor_hydrant_intact.webp')),
  hydG: loadW(path.join(EVT, 'anchor_hydrant_geyser.webp')),
};

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

await page.setContent(`<body style="margin:0;background:transparent;"><script>
const INK = '#210f2e';
function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function inkRect(g, x, y, w, h, fill, lw = 2.2) {
  g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = INK; g.lineWidth = lw; g.strokeRect(x, y, w, h);
}
function drawShards(g, cx, cy, count, col, sz = 5, seed = 1, spreadX = 32, spreadY = 18) {
  for (let i = 0; i < count; i++) {
    const a = (i * 2.3999 + seed * 1.1) % (Math.PI * 2);
    const px = cx + Math.cos(a) * ((0.35 + ((i * 37) % 10) / 15) * spreadX);
    const py = cy + Math.sin(a) * ((0.35 + ((i * 53) % 10) / 15) * spreadY);
    g.save(); g.translate(px, py); g.rotate(a + i * 0.7);
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-sz, -sz * 0.35); g.lineTo(sz * 0.85, 0); g.lineTo(-sz * 0.3, sz * 0.55);
    g.closePath(); g.fill(); g.stroke(); g.restore();
  }
}

window.buildSprites = async (r) => {
  const hyd0 = new Image(); hyd0.src = r.hyd0; await new Promise(res => hyd0.onload = res);
  const hydG = new Image(); hydG.src = r.hydG; await new Promise(res => hydG.onload = res);
  const out = {};

  // 1. storefront glass_bay_s0..s3 (192x64 = 96x32 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(192, 64); g.translate(96, 32);
    // Drop shadow onto apron
    g.fillStyle = 'rgba(33,15,46,0.22)'; g.fillRect(-84, -8, 172, 24);
    inkRect(g, -86, -12, 172, 22, s === 3 ? '#181224' : '#7ac9e8', 2.4);
    if (s < 3) {
      g.fillStyle = 'rgba(255,255,255,0.44)';
      for (const px of [-86, -29, 28]) {
        g.beginPath(); g.moveTo(px + 6, -10); g.lineTo(px + 18, -10); g.lineTo(px + 8, 7); g.lineTo(px + 2, 7); g.closePath(); g.fill();
      }
      g.strokeStyle = '#4f3a36'; g.lineWidth = 3;
      for (const mx of [-29, 28]) { g.beginPath(); g.moveTo(mx, -12); g.lineTo(mx, 10); g.stroke(); }
    }
    if (s === 1) {
      g.strokeStyle = '#33293a'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-22, -2); g.quadraticCurveTo(2, 5, 26, -3); g.stroke();
      g.strokeStyle = '#f2fbff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(10, -10); g.lineTo(2, 0); g.lineTo(14, 8); g.stroke();
    } else if (s === 2) {
      g.strokeStyle = '#eefaff'; g.lineWidth = 1.7;
      for (const [x0, y0] of [[-12, -2], [46, -1]]) for (let k = 0; k < 7; k++) {
        const ang = k * 0.9; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(ang) * 14, y0 + Math.sin(ang) * 9); g.stroke();
      }
      drawShards(g, 16, 16, 5, '#cbeeff', 4.2, 2, 24, 10);
    } else if (s === 3) {
      g.fillStyle = '#dff6ff'; g.strokeStyle = INK; g.lineWidth = 1.4;
      for (const tx of [-70, -48, -18, 16, 42, 68]) {
        g.beginPath(); g.moveTo(tx - 5, -11); g.lineTo(tx, -3); g.lineTo(tx + 5, -11); g.closePath(); g.fill(); g.stroke();
      }
      g.save(); g.translate(-12, 18); g.rotate(0.26); inkRect(g, -16, -2.5, 32, 5, '#59423d', 1.8); g.restore();
      drawShards(g, 8, 18, 11, '#bfeaff', 4.6, 5, 38, 10);
    }
    out['glass_bay_s' + s] = c.toDataURL('image/png');
  }

  // 2. awning_coral_s0..s3 (192x80 = 96x40 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(192, 80); g.translate(96, 40);
    if (s === 0) {
      g.fillStyle = 'rgba(33,15,46,0.24)'; g.fillRect(-84, -14, 174, 42);
      for (let k = 0; k < 8; k++) inkRect(g, -88 + k * 22, -20, 22, 38, k % 2 === 0 ? '#e65b65' : '#fff2dc', 2.0);
      g.strokeStyle = INK; g.lineWidth = 2.4; g.strokeRect(-88, -20, 176, 38);
    } else if (s === 1) {
      g.fillStyle = 'rgba(33,15,46,0.22)';
      g.beginPath(); g.moveTo(-88, -14); g.quadraticCurveTo(0, -4, 88, -14); g.lineTo(88, 22); g.quadraticCurveTo(0, 12, -88, 22); g.fill();
      for (let k = 0; k < 8; k++) {
        const x = -88 + k * 22, dip = Math.sin(((k + 0.5) / 8) * Math.PI) * 9;
        g.fillStyle = k % 2 === 0 ? '#e65b65' : '#fff2dc';
        g.beginPath(); g.moveTo(x, -20); g.lineTo(x + 22, -20); g.lineTo(x + 22, 18 - dip); g.lineTo(x, 18 - dip * 0.9);
        g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      }
      g.strokeStyle = '#3c2539'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-24, -4); g.lineTo(18, 2); g.stroke();
    } else if (s === 2) {
      g.strokeStyle = '#5f687a'; g.lineWidth = 3;
      for (const rx of [22, 54, 82]) { g.beginPath(); g.moveTo(rx, -20); g.lineTo(rx - 6, 12); g.stroke(); }
      for (let k = 0; k < 4; k++) inkRect(g, -88 + k * 22, -20, 22, 36, k % 2 === 0 ? '#e65b65' : '#fff2dc', 2.0);
      g.save(); g.translate(10, 4); g.rotate(0.45);
      for (let k = 0; k < 3; k++) inkRect(g, k * 19, 0, 19, 28, k % 2 === 0 ? '#fff2dc' : '#e65b65', 2.0);
      g.restore();
    } else {
      g.strokeStyle = '#535b6b'; g.lineWidth = 3.2;
      for (const rx of [-70, -24, 24, 70]) { g.beginPath(); g.moveTo(rx, -20); g.lineTo(rx + (rx > 0 ? -9 : 8), -2); g.stroke(); }
      drawShards(g, -18, 14, 4, '#e65b65', 10, 1, 26, 12); drawShards(g, 24, 16, 4, '#fff2dc', 9, 3, 26, 12);
    }
    out['awning_coral_s' + s] = c.toDataURL('image/png');
  }

  // 3. sign_nova_s0..s3 (160x96 = 80x48 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(160, 96); g.translate(80, 48);
    const drawSign = (ang, ox, oy, cracked) => {
      g.save(); g.translate(ox, oy); g.rotate(ang);
      g.fillStyle = 'rgba(33,15,46,0.28)'; g.fillRect(-48, 8, 102, 24);
      inkRect(g, -52, -14, 104, 30, '#2d1c3d', 2.4);
      g.font = 'bold 19px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = cracked >= 3 ? '#6d4b6e' : '#ff4fc3';
      g.fillText(cracked >= 2 ? 'NO  A' : 'NOVA', 0, 2);
      if (cracked >= 1 && cracked < 3) { g.strokeStyle = '#ffdf78'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, -8); g.lineTo(20, 12); g.stroke(); }
      g.restore();
    };
    if (s === 0) drawSign(0, 0, -4, 0);
    else if (s === 1) { g.strokeStyle = '#474f5e'; g.lineWidth = 3; g.beginPath(); g.moveTo(-40, -24); g.lineTo(-46, -8); g.stroke(); drawSign(0.24, 2, 0, 1); }
    else if (s === 2) { g.strokeStyle = '#ffe56b'; g.lineWidth = 2; g.beginPath(); g.moveTo(-34, -20); g.quadraticCurveTo(-22, -4, -16, 6); g.stroke(); drawSign(-0.56, 10, 10, 2); }
    else { drawSign(0.16, 4, 14, 3); drawShards(g, -20, 24, 7, '#ff7cd5', 4.5, 4, 28, 12); inkRect(g, -38, -28, 7, 7, '#4a4152', 1.8); inkRect(g, 32, -28, 7, 7, '#4a4152', 1.8); }
    out['sign_nova_s' + s] = c.toDataURL('image/png');
  }

  // 4. fence_picket_s0..s3 (160x64 = 80x32 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(160, 64); g.translate(80, 32);
    g.fillStyle = 'rgba(33,15,46,0.20)'; if (s < 2) g.fillRect(-72, 2, 148, 8);
    if (s === 0) { inkRect(g, -74, -4, 148, 7, '#f6efe6', 2.0); for (let x = -70; x <= 70; x += 23.3) inkRect(g, x - 4, -8, 8, 16, '#fffaf2', 2.0); }
    else if (s === 1) {
      g.strokeStyle = INK; g.lineWidth = 2.0; g.fillStyle = '#f6efe6';
      g.beginPath(); g.moveTo(-74, -4); g.quadraticCurveTo(0, -13, 74, -4); g.lineTo(74, 3); g.quadraticCurveTo(0, -6, -74, 3); g.closePath(); g.fill(); g.stroke();
      for (const x of [-70, -46, 46, 70]) inkRect(g, x - 4, -8, 8, 16, '#fffaf2', 2.0);
      g.save(); g.translate(0, -7); g.rotate(0.26); inkRect(g, -5, -8, 10, 16, '#efe2d3', 2.0); g.restore();
    } else if (s === 2) {
      for (const x of [-70, -46, 46, 70]) inkRect(g, x - 4, -8, 8, 16, '#fffaf2', 2.0);
      g.save(); g.translate(-56, 0); g.rotate(-0.18); inkRect(g, -18, -3.5, 36, 7, '#f6efe6', 1.8); g.restore();
      g.save(); g.translate(56, 0); g.rotate(0.22); inkRect(g, -18, -3.5, 36, 7, '#f6efe6', 1.8); g.restore();
      drawShards(g, 0, 10, 7, '#f6efe6', 6, 2, 26, 12);
    } else {
      for (const x of [-70, -23, 23, 70]) inkRect(g, x - 3.5, -3.5, 7, 7, '#ccbda9', 1.8);
      drawShards(g, 0, 8, 10, '#f3eadf', 6.5, 6, 36, 14);
    }
    out['fence_picket_s' + s] = c.toDataURL('image/png');
  }

  // 5. fence_chain_s0..s3 (160x64 = 80x32 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(160, 64); g.translate(80, 32);
    if (s === 0) { inkRect(g, -74, -3, 148, 5, '#9ca8ba', 1.8); for (const x of [-70, -23, 23, 70]) inkRect(g, x - 3.5, -7, 7, 13, '#798598', 1.8); }
    else if (s === 1) {
      g.strokeStyle = INK; g.lineWidth = 1.8; g.fillStyle = '#9ca8ba';
      g.beginPath(); g.moveTo(-74, -3); g.quadraticCurveTo(0, -16, 74, -3); g.lineTo(74, 2); g.quadraticCurveTo(0, -11, -74, 2); g.closePath(); g.fill(); g.stroke();
      for (const x of [-70, 70]) inkRect(g, x - 3.5, -7, 7, 13, '#798598', 1.8);
      inkRect(g, -3.5, -16, 7, 13, '#798598', 1.8);
    } else if (s === 2) {
      for (const x of [-70, 70]) inkRect(g, x - 3.5, -7, 7, 13, '#798598', 1.8);
      g.save(); g.translate(-44, 5); g.rotate(0.42); inkRect(g, -26, -2.5, 52, 5, '#9ca8ba', 1.8); g.restore();
      g.save(); g.translate(44, -8); g.rotate(-0.38); inkRect(g, -26, -2.5, 52, 5, '#9ca8ba', 1.8); g.restore();
      inkRect(g, -3, 14, 6, 6, '#5c6678', 1.5);
    } else {
      for (const x of [-70, -23, 23, 70]) inkRect(g, x - 3, -3, 6, 6, '#5c6678', 1.6);
      drawShards(g, 0, 5, 8, '#95a1b4', 7.5, 4, 34, 12);
    }
    out['fence_chain_s' + s] = c.toDataURL('image/png');
  }

  // 6. hydrant_s0..s3 (96x96 = 48x48 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(96, 96); g.translate(48, 48);
    if (s === 0) g.drawImage(hyd0, -30, -30, 60, 60);
    else if (s === 1) {
      g.fillStyle = 'rgba(110,208,245,0.48)'; g.beginPath(); g.ellipse(6, 8, 24, 14, 0.2, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(3, -2); g.rotate(0.32); g.drawImage(hyd0, -28, -28, 56, 56); g.restore();
      g.strokeStyle = '#dff7ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -6); g.lineTo(24, -14); g.moveTo(12, -2); g.lineTo(26, 0); g.stroke();
    } else if (s === 2) {
      g.fillStyle = 'rgba(92,196,242,0.52)'; g.beginPath(); g.ellipse(0, 10, 44, 26, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(hydG, -46, -46, 92, 92);
    } else {
      g.fillStyle = 'rgba(84,182,232,0.56)'; g.beginPath(); g.ellipse(0, 3, 44, 28, -0.1, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#dff7ff'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 1.6); g.stroke();
      inkRect(g, -8, -8, 16, 16, '#7a252a', 2.0);
      g.save(); g.translate(24, 12); g.rotate(0.8); inkRect(g, -9, -6, 18, 12, '#e0423f', 1.8); g.restore();
    }
    out['hydrant_s' + s] = c.toDataURL('image/png');
  }

  // 7. market_stall_s0..s3 (144x112 = 72x56 wu)
  for (let s = 0; s < 4; s++) {
    const [c, g] = make(144, 112); g.translate(72, 56);
    const drawCanopy = (x, y, rot, squashY, torn) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, squashY);
      g.fillStyle = 'rgba(33,15,46,0.22)'; g.fillRect(-44, -26, 92, 58);
      for (let k = 0; k < 5; k++) if (!(torn && k === 3)) inkRect(g, -45 + k * 18, -28, 18, 56, k % 2 === 0 ? '#2fa8b8' : '#fff5df', 2.0);
      g.restore();
    };
    if (s === 0) { inkRect(g, -40, 26, 80, 14, '#b87f4d', 2.0); drawCanopy(0, -4, 0, 1, false); }
    else if (s === 1) { inkRect(g, -38, 28, 76, 14, '#b87f4d', 2.0); drawCanopy(4, -4, 0.20, 0.92, false); drawShards(g, -36, 36, 4, '#ff7f45', 4.5, 1, 20, 10); }
    else if (s === 2) { drawShards(g, 18, 24, 5, '#b87f4d', 7.5, 3, 26, 14); drawCanopy(-8, 2, -0.34, 0.68, true); drawShards(g, 32, -10, 5, '#ffbb3b', 4, 7, 22, 12); }
    else { drawShards(g, -14, 6, 6, '#b87f4d', 8.5, 2, 34, 20); drawShards(g, 10, 4, 5, '#2fa8b8', 10, 5, 30, 18); drawShards(g, -4, 14, 4, '#fff5df', 9, 8, 30, 18); }
    out['market_stall_s' + s] = c.toDataURL('image/png');
  }

  return out;
};
</script></body>`);

const imgs = await page.evaluate((r) => window.buildSprites(r), refs);
for (const [name, dataUrl] of Object.entries(imgs)) {
  const pngPath = path.join(TMP, `${name}.png`), webpPath = path.join(OUT, `${name}.webp`);
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execSync(`"${cwebp}" -quiet -q 90 -alpha_q 100 "${pngPath}" -o "${webpPath}"`);
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('Generated Phase 2 WebPs:', Object.keys(imgs).length, 'into', OUT);
