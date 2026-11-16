// build_night_sprites.mjs — generate 21 True Night WebP sprites in shots/night-sprites/
// Usage: CHROME=/path/to/chrome node tools/build_night_sprites.mjs
// Requires: /opt/homebrew/bin/cwebp (or cwebp on PATH)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'shots', 'night-sprites');
const TMP = '/tmp/build_night_png';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const cwebp = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';
const loadW = (f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(ASSETS, f)).toString('base64');

const carRefB64 = loadW('car_sedan_teal.webp');
const pedRefB64 = loadW('ped_ped_blue.webp');
const BLD_IDS = ['club', 'diner', 'motel', 'hotel', 'shops', 'apartments', 'office', 'police', 'garage'];
const bldData = Object.fromEntries(BLD_IDS.map((id) => [id, {
  day: loadW(`bld_${id}.webp`),
  night: loadW(`bld_${id}_night.webp`),
}]));

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

await page.setContent(`<body style="margin:0;background:transparent;"><script>
function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function drawHeadlightCone(ctx, cx, y0, len, spread, coreCol, midCol, alphaMult = 1.0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gOuter = ctx.createRadialGradient(cx, y0, 2, cx, y0 - len * 0.58, len * 0.72);
  gOuter.addColorStop(0.0, coreCol.replace('ALPHA', (0.72 * alphaMult).toFixed(3)));
  gOuter.addColorStop(0.32, midCol.replace('ALPHA', (0.38 * alphaMult).toFixed(3)));
  gOuter.addColorStop(0.75, midCol.replace('ALPHA', (0.10 * alphaMult).toFixed(3)));
  gOuter.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = gOuter;
  ctx.beginPath(); ctx.moveTo(cx - 2, y0);
  ctx.bezierCurveTo(cx - spread * 0.45, y0 - len * 0.35, cx - spread, y0 - len * 0.75, cx - spread * 0.85, y0 - len);
  ctx.lineTo(cx + spread * 0.85, y0 - len);
  ctx.bezierCurveTo(cx + spread, y0 - len * 0.75, cx + spread * 0.45, y0 - len * 0.35, cx + 2, y0);
  ctx.closePath(); ctx.filter = 'blur(3.2px)'; ctx.fill(); ctx.filter = 'none';
  const gInner = ctx.createLinearGradient(cx, y0, cx, y0 - len * 0.85);
  gInner.addColorStop(0.0, coreCol.replace('ALPHA', (0.95 * alphaMult).toFixed(3)));
  gInner.addColorStop(0.28, midCol.replace('ALPHA', (0.48 * alphaMult).toFixed(3)));
  gInner.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = gInner; ctx.beginPath(); ctx.moveTo(cx - 1.5, y0);
  ctx.lineTo(cx - spread * 0.42, y0 - len * 0.82);
  ctx.quadraticCurveTo(cx, y0 - len * 0.90, cx + spread * 0.42, y0 - len * 0.82);
  ctx.lineTo(cx + 1.5, y0); ctx.closePath(); ctx.filter = 'blur(1.4px)'; ctx.fill();
  ctx.restore();
}
function drawLensFlare(ctx, x, y, r, rgbaCore, rgbaGlow) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0.5, x, y, r);
  g.addColorStop(0, rgbaCore); g.addColorStop(0.35, rgbaGlow); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

window.renderAll5A = async (carB64, pedB64) => {
  const out = {};
  {
    const [c, g] = makeCanvas(56, 176);
    drawHeadlightCone(g, 21.5, 111, 102, 16, 'rgba(255,250,224,ALPHA)', 'rgba(255,232,163,ALPHA)', 0.95);
    drawHeadlightCone(g, 34.5, 111, 102, 16, 'rgba(255,250,224,ALPHA)', 'rgba(255,232,163,ALPHA)', 0.95);
    drawLensFlare(g, 21.5, 111, 5.5, 'rgba(255,253,242,1)', 'rgba(255,240,190,0.65)');
    drawLensFlare(g, 34.5, 111, 5.5, 'rgba(255,253,242,1)', 'rgba(255,240,190,0.65)');
    drawLensFlare(g, 22, 146, 11, 'rgba(255,140,150,0.95)', 'rgba(255,38,58,0.62)');
    drawLensFlare(g, 34, 146, 11, 'rgba(255,140,150,0.95)', 'rgba(255,38,58,0.62)');
    drawLensFlare(g, 28, 150, 15, 'rgba(255,40,62,0.34)', 'rgba(180,15,35,0.14)');
    out.night_headlight_quartz = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(72, 224);
    drawHeadlightCone(g, 28.5, 154, 146, 22, 'rgba(255,252,235,ALPHA)', 'rgba(255,222,138,ALPHA)', 1.0);
    drawHeadlightCone(g, 43.5, 154, 146, 22, 'rgba(255,252,235,ALPHA)', 'rgba(255,222,138,ALPHA)', 1.0);
    drawLensFlare(g, 36, 95, 28, 'rgba(255,246,204,0.22)', 'rgba(255,216,130,0.08)');
    drawLensFlare(g, 28.5, 154, 7, 'rgba(255,255,245,1)', 'rgba(255,235,170,0.75)');
    drawLensFlare(g, 43.5, 154, 7, 'rgba(255,255,245,1)', 'rgba(255,235,170,0.75)');
    drawLensFlare(g, 29, 192, 13, 'rgba(255,155,165,0.95)', 'rgba(255,34,58,0.68)');
    drawLensFlare(g, 43, 192, 13, 'rgba(255,155,165,0.95)', 'rgba(255,34,58,0.68)');
    drawLensFlare(g, 36, 193, 12, 'rgba(255,58,76,0.52)', 'rgba(210,18,40,0.20)');
    out.night_headlight_highbeam = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(56, 176);
    drawHeadlightCone(g, 21.5, 111, 104, 16, 'rgba(242,249,255,ALPHA)', 'rgba(198,228,255,ALPHA)', 0.96);
    drawHeadlightCone(g, 34.5, 111, 104, 16, 'rgba(242,249,255,ALPHA)', 'rgba(198,228,255,ALPHA)', 0.96);
    drawLensFlare(g, 21.5, 111, 5.5, 'rgba(245,252,255,1)', 'rgba(180,224,255,0.70)');
    drawLensFlare(g, 34.5, 111, 5.5, 'rgba(245,252,255,1)', 'rgba(180,224,255,0.70)');
    drawLensFlare(g, 23, 129, 9.5, 'rgba(255,95,115,0.88)', 'rgba(255,36,64,0.34)');
    drawLensFlare(g, 33, 129, 9.5, 'rgba(105,195,255,0.88)', 'rgba(42,135,255,0.34)');
    drawLensFlare(g, 22, 146, 11, 'rgba(255,140,150,0.92)', 'rgba(255,36,58,0.58)');
    drawLensFlare(g, 34, 146, 11, 'rgba(255,140,150,0.92)', 'rgba(255,36,58,0.58)');
    out.night_headlight_police = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(64, 200);
    drawHeadlightCone(g, 22, 124, 114, 19, 'rgba(255,242,202,ALPHA)', 'rgba(255,198,112,ALPHA)', 0.92);
    drawHeadlightCone(g, 42, 124, 114, 19, 'rgba(255,242,202,ALPHA)', 'rgba(255,198,112,ALPHA)', 0.92);
    drawLensFlare(g, 22, 124, 6.5, 'rgba(255,248,225,1)', 'rgba(255,212,132,0.72)');
    drawLensFlare(g, 42, 124, 6.5, 'rgba(255,248,225,1)', 'rgba(255,212,132,0.72)');
    for (const mx of [24, 32, 40]) drawLensFlare(g, mx, 134, 4.5, 'rgba(255,220,120,0.95)', 'rgba(255,152,32,0.50)');
    drawLensFlare(g, 22, 174, 12, 'rgba(255,140,145,0.92)', 'rgba(255,38,54,0.58)');
    drawLensFlare(g, 42, 174, 12, 'rgba(255,140,145,0.92)', 'rgba(255,38,54,0.58)');
    out.night_headlight_heavy = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(48, 48);
    drawLensFlare(g, 15, 24, 13, 'rgba(255,165,172,1)', 'rgba(255,28,50,0.68)');
    drawLensFlare(g, 33, 24, 13, 'rgba(255,165,172,1)', 'rgba(255,28,50,0.68)');
    drawLensFlare(g, 24, 24, 14, 'rgba(255,48,68,0.42)', 'rgba(185,12,32,0.16)');
    drawLensFlare(g, 19, 25, 4.5, 'rgba(255,250,240,0.9)', 'rgba(255,220,180,0.4)');
    drawLensFlare(g, 29, 25, 4.5, 'rgba(255,250,240,0.9)', 'rgba(255,220,180,0.4)');
    out.night_taillight_brake = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(160, 160);
    const grad = g.createRadialGradient(80, 80, 3, 80, 80, 74);
    grad.addColorStop(0.0, 'rgba(255,245,214,0.98)'); grad.addColorStop(0.14, 'rgba(255,224,148,0.78)');
    grad.addColorStop(0.42, 'rgba(255,186,84,0.40)'); grad.addColorStop(0.75, 'rgba(255,152,52,0.12)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(80, 80, 76, 0, Math.PI * 2); g.fill();
    g.save(); g.filter = 'blur(2.5px)';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.3, rx = 80 + Math.cos(a) * 24, ry = 80 + Math.sin(a) * 24;
      const rg = g.createRadialGradient(rx, ry, 2, rx, ry, 24);
      rg.addColorStop(0, 'rgba(255,205,110,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(rx, ry, 24, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    drawLensFlare(g, 80, 80, 12, 'rgba(255,252,238,1)', 'rgba(255,232,164,0.8)');
    out.night_lamp_pool_amber = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(304, 152);
    const drawPool = (x, y, r, peak) => {
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(255,244,210,' + peak + ')');
      gr.addColorStop(0.24, 'rgba(255,204,112,' + (peak * 0.68) + ')');
      gr.addColorStop(0.62, 'rgba(255,172,72,' + (peak * 0.26) + ')');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    drawPool(88, 62, 68, 0.92); drawPool(216, 62, 68, 0.92); drawPool(258, 76, 48, 0.72);
    g.save(); g.filter = 'blur(2.4px)';
    for (const sx of [88, 216, 258]) for (let k = 0; k < 7; k++) {
      const yy = 92 + k * 7.5, w = 18 - k * 1.4 + Math.sin(k * 1.9) * 3, al = 0.38 * (1 - k / 7.5);
      g.fillStyle = 'rgba(255,198,92,' + al.toFixed(3) + ')';
      g.beginPath(); g.ellipse(sx + Math.sin(k * 2.1) * 2.5, yy, Math.max(4, w), 3.2, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    out.night_pier_lantern = c.toDataURL('image/png');
  }
  {
    const carImg = new Image(); carImg.src = carB64; await new Promise(r => carImg.onload = r);
    const [srcC, srcG] = makeCanvas(1024, 512); srcG.drawImage(carImg, 0, 0);
    const srcPx = srcG.getImageData(0, 0, 1024, 512).data;
    const [c, g] = makeCanvas(1024, 512), outImg = g.createImageData(1024, 512), d = outImg.data;
    for (let y = 1; y < 511; y++) for (let x = 1; x < 1023; x++) {
      const idx = (y * 1024 + x) * 4, a = srcPx[idx + 3]; if (a < 28) continue;
      const lum = srcPx[idx] * 0.3 + srcPx[idx + 1] * 0.59 + srcPx[idx + 2] * 0.11;
      const aUL = srcPx[((y - 2 >= 0 ? y - 2 : 0) * 1024 + (x - 2 >= 0 ? x - 2 : 0)) * 4 + 3];
      const aLR = srcPx[((y + 2 < 512 ? y + 2 : 511) * 1024 + (x + 2 < 1024 ? x + 2 : 1023)) * 4 + 3];
      if (aUL < 40 && a > 90) { d[idx] = 178; d[idx + 1] = 220; d[idx + 2] = 255; d[idx + 3] = Math.min(230, Math.round(a * 0.85)); }
      else if (aLR < 45 && a > 90) { d[idx] = 255; d[idx + 1] = 178; d[idx + 2] = 92; d[idx + 3] = Math.min(185, Math.round(a * 0.65)); }
      else if (lum < 78 && srcPx[idx + 2] > srcPx[idx] + 6) {
        const band = Math.sin((x + y) * 0.28) * 0.5 + 0.5;
        if (band > 0.62) { d[idx] = 155; d[idx + 1] = 205; d[idx + 2] = 255; d[idx + 3] = Math.round(92 * band); }
      }
    }
    g.putImageData(outImg, 0, 0);
    const [fc, fg] = makeCanvas(1024, 512); fg.filter = 'blur(0.75px)'; fg.drawImage(c, 0, 0);
    fg.filter = 'none'; fg.globalAlpha = 0.65; fg.drawImage(c, 0, 0);
    out.night_car_accent_sheet = fc.toDataURL('image/png');
  }
  {
    const pedImg = new Image(); pedImg.src = pedB64; await new Promise(r => pedImg.onload = r);
    const [srcC, srcG] = makeCanvas(1032, 344); srcG.drawImage(pedImg, 0, 0);
    const srcPx = srcG.getImageData(0, 0, 1032, 344).data;
    const [c, g] = makeCanvas(1032, 344), outImg = g.createImageData(1032, 344), d = outImg.data;
    for (let y = 1; y < 343; y++) for (let x = 1; x < 1031; x++) {
      const idx = (y * 1032 + x) * 4, a = srcPx[idx + 3]; if (a < 32) continue;
      const aUL = srcPx[((y - 2 >= 0 ? y - 2 : 0) * 1032 + (x - 2 >= 0 ? x - 2 : 0)) * 4 + 3];
      const aLR = srcPx[((y + 2 < 344 ? y + 2 : 343) * 1032 + (x + 2 < 1032 ? x + 2 : 1031)) * 4 + 3];
      if (aUL < 45 && a > 80) { d[idx] = 170; d[idx + 1] = 216; d[idx + 2] = 255; d[idx + 3] = Math.min(235, Math.round(a * 0.90)); }
      else if (aLR < 50 && a > 80) { d[idx] = 255; d[idx + 1] = 192; d[idx + 2] = 110; d[idx + 3] = Math.min(180, Math.round(a * 0.68)); }
    }
    g.putImageData(outImg, 0, 0);
    const [fc, fg] = makeCanvas(1032, 344); fg.filter = 'blur(0.6px)'; fg.drawImage(c, 0, 0);
    out.night_ped_accent_sheet = fc.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(56, 88);
    drawHeadlightCone(g, 28, 72, 66, 17, 'rgba(255,252,235,ALPHA)', 'rgba(195,232,255,ALPHA)', 0.92);
    drawLensFlare(g, 28, 72, 5.5, 'rgba(255,255,248,1)', 'rgba(215,240,255,0.72)');
    out.night_ped_flashlight = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(512, 128);
    const band = g.createLinearGradient(0, 0, 0, 128);
    band.addColorStop(0.0, 'rgba(5,10,30,0)'); band.addColorStop(0.35, 'rgba(8,22,58,0.42)'); band.addColorStop(1.0, 'rgba(5,10,30,0.88)');
    g.fillStyle = band; g.fillRect(0, 0, 512, 128);
    const drawWaveRibbon = (yBase, amp, freqMult, width, col) => {
      g.save(); g.filter = 'blur(1.4px)'; g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.beginPath();
      for (let x = -16; x <= 528; x += 4) {
        const t = (x / 512) * Math.PI * 2, yy = yBase + Math.sin(t * freqMult) * amp + Math.cos(t * (freqMult + 1)) * (amp * 0.45);
        if (x === -16) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke(); g.restore();
    };
    drawWaveRibbon(38, 4.2, 2, 7.5, 'rgba(110,175,245,0.20)'); drawWaveRibbon(37, 4.2, 2, 2.4, 'rgba(205,235,255,0.44)');
    drawWaveRibbon(68, 5.0, 3, 9.0, 'rgba(95,165,240,0.22)'); drawWaveRibbon(67, 5.0, 3, 2.6, 'rgba(218,242,255,0.52)');
    drawWaveRibbon(98, 4.5, 2, 6.5, 'rgba(130,192,255,0.18)'); drawWaveRibbon(97, 4.5, 2, 2.0, 'rgba(195,228,255,0.34)');
    for (let i = 0; i < 42; i++) {
      const sx = (i * 12.2 + Math.sin(i * 3.1) * 5) % 512, sy = 36 + (i % 3) * 30 + Math.sin((sx / 512) * Math.PI * 4) * 3.8;
      drawLensFlare(g, sx, sy, 2.4 + (i % 3) * 0.9, 'rgba(230,246,255,0.68)', 'rgba(130,195,255,0.24)');
    }
    out.night_water_edge_shore = c.toDataURL('image/png');
  }
  {
    const [c, g] = makeCanvas(512, 256);
    for (let f = 0; f < 4; f++) {
      const fx = (f % 2) * 256, fy = Math.floor(f / 2) * 128, phase = (f / 4) * Math.PI * 2;
      g.save(); g.beginPath(); g.rect(fx, fy, 256, 128); g.clip();
      for (let i = 0; i < 24; i++) {
        const y = fy + ((i * 5.3 + f * 3) % 120) + 4, x = fx + ((i * 37 + f * 17) % 216) + 12;
        const len = 16 + (i % 4) * 9, alpha = 0.22 + 0.24 * (0.5 + 0.5 * Math.sin(phase + i * 1.4));
        const wg = g.createLinearGradient(x, y, x + len, y);
        wg.addColorStop(0, 'rgba(140,200,255,0)');
        wg.addColorStop(0.5, 'rgba(195,232,255,' + alpha.toFixed(3) + ')');
        wg.addColorStop(1, 'rgba(140,200,255,0)');
        g.strokeStyle = wg; g.lineWidth = 2.0 + (i % 2) * 0.8; g.beginPath();
        g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.5, y + Math.sin(phase + i) * 2.2, x + len, y); g.stroke();
      }
      g.restore();
    }
    out.night_water_shimmer_sheet = c.toDataURL('image/png');
  }
  return out;
};

window.buildAll5B = async (input) => {
  const results = {};
  for (const id of Object.keys(input)) {
    const nImg = new Image(); nImg.src = input[id].night; await new Promise(r => nImg.onload = r);
    const w = nImg.width, h = nImg.height, [srcC, srcG] = makeCanvas(w, h);
    srcG.drawImage(nImg, 0, 0);
    const px = srcG.getImageData(0, 0, w, h), d = px.data;
    for (let y = 0; y < h; y++) {
      const fy = Math.min(1, y / 12, (h - 1 - y) / 12);
      for (let x = 0; x < w; x++) {
        const edge = Math.min(Math.min(1, x / 12, (w - 1 - x) / 12), fy), i = (y * w + x) * 4;
        let r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b);
        if (mx <= 4) { d[i + 3] = 0; continue; }
        const alpha = Math.min(255, Math.max(0, Math.round((mx - 4) * 1.18 * edge)));
        if (r > b + 24 && mx > 60) { r = Math.min(255, Math.round(r * 1.14)); g = Math.min(255, Math.round(g * 1.07 + 8)); b = Math.max(0, Math.round(b * 0.86)); }
        if (r > 130 && b > 90 && g < r * 0.65) { r = Math.min(255, Math.round(r * 1.16)); b = Math.min(255, Math.round(b * 1.14)); }
        if (b > 130 && g > 110 && r < g * 0.8) { g = Math.min(255, Math.round(g * 1.12)); b = Math.min(255, Math.round(b * 1.15)); }
        const boost = alpha > 8 ? Math.min(1.6, 255 / Math.max(40, mx)) * 0.35 + 0.65 : 1;
        d[i] = Math.min(255, Math.round(r * boost)); d[i + 1] = Math.min(255, Math.round(g * boost));
        d[i + 2] = Math.min(255, Math.round(b * boost)); d[i + 3] = alpha;
      }
    }
    srcG.putImageData(px, 0, 0);
    const [outC, outG] = makeCanvas(w, h);
    outG.save(); outG.filter = 'blur(4.5px)'; outG.globalAlpha = 0.58; outG.drawImage(srcC, 0, 0);
    outG.filter = 'none'; outG.globalAlpha = 1.0; outG.drawImage(srcC, 0, 0); outG.restore();
    if (id === 'diner') {
      outG.save(); outG.globalCompositeOperation = 'destination-out'; outG.fillStyle = 'rgba(0,0,0,0.42)';
      for (const mx of [126, 156, 186]) outG.fillRect(mx, 148, 2, 42);
      outG.restore();
    }
    results['night_bld_' + id] = outC.toDataURL('image/png');
  }
  return results;
};
</script></body>`);

const all5A = await page.evaluate(([c, p]) => window.renderAll5A(c, p), [carRefB64, pedRefB64]);
const all5B = await page.evaluate((d) => window.buildAll5B(d), bldData);
for (const [name, dataUrl] of Object.entries({ ...all5A, ...all5B })) {
  const pngPath = path.join(TMP, `${name}.png`), webpPath = path.join(OUT, `${name}.webp`);
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execSync(`"${cwebp}" -quiet -q 92 "${pngPath}" -o "${webpPath}"`);
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('Wrote 21 True Night WebPs to', OUT);
