// build_shorts_art.mjs — generate 4 1080x1920 vertical Shorts Key Art hero frames
// Usage: CHROME=/path/to/chrome node tools/build_shorts_art.mjs
// Outputs: shots/shorts-art/short-{1..4}-*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'shots');
const OUT = path.join(SHOTS, 'shorts-art');
fs.mkdirSync(OUT, { recursive: true });

const loadPng = (name) => 'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, name)).toString('base64');
const srcs = {
  siege: loadPng('siege-target-golden.png'),
  pressure: loadPng('pressure-target-dusk.png'),
  wreck: loadPng('destruction-target-scene.png'),
  nova: loadPng('gemini-target-golden.png'),
};

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

await page.setContent(`<body style="margin:0;background:#110a1a;"><canvas id="c" width="1080" height="1920"></canvas><script>
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function drawKeyArtChrome(g, opts) {
  const W = 1080, H = 1920;
  const tg = g.createLinearGradient(0, 0, 0, 420);
  tg.addColorStop(0.0, opts.topCol0); tg.addColorStop(0.55, opts.topCol1); tg.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = tg; g.fillRect(0, 0, W, 420);
  const bg = g.createLinearGradient(0, H - 340, 0, H);
  bg.addColorStop(0.0, 'rgba(0,0,0,0)'); bg.addColorStop(0.55, opts.botCol1); bg.addColorStop(1.0, opts.botCol0);
  g.fillStyle = bg; g.fillRect(0, H - 340, W, 340);
  const rg = g.createRadialGradient(W/2, H*0.52, 420, W/2, H*0.52, 1140);
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(14,7,24,0.44)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 84px "Arial Black", Impact, sans-serif'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(18,8,30,0.85)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
  g.lineWidth = 14; g.strokeStyle = '#210f2e'; g.strokeText('PALM CITY', W/2, 138);
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  const wg = g.createLinearGradient(0, 96, 0, 178);
  wg.addColorStop(0.0, '#fff7cf'); wg.addColorStop(0.45, '#ffc459'); wg.addColorStop(1.0, '#ff5e82');
  g.fillStyle = wg; g.fillText('PALM CITY', W/2, 138);
  g.font = '900 54px "Arial Black", Impact, sans-serif';
  const tw = g.measureText(opts.badge).width, bw = Math.max(460, tw + 88), bh = 86, bx = (W - bw)/2, by = 198;
  g.save(); g.shadowColor = opts.badgeGlow; g.shadowBlur = 28;
  roundRectPath(g, bx, by, bw, bh, 18);
  const bbg = g.createLinearGradient(bx, by, bx + bw, by + bh);
  bbg.addColorStop(0, opts.badgeBg0); bbg.addColorStop(1, opts.badgeBg1);
  g.fillStyle = bbg; g.fill(); g.shadowBlur = 0; g.lineWidth = 5; g.strokeStyle = '#210f2e'; g.stroke(); g.restore();
  g.lineWidth = 8; g.strokeStyle = '#210f2e'; g.strokeText(opts.badge, W/2, by + bh/2 + 2);
  g.fillStyle = '#fff9ee'; g.fillText(opts.badge, W/2, by + bh/2 + 2);
  g.font = '800 28px "Helvetica Neue", Arial, sans-serif';
  g.lineWidth = 6; g.strokeStyle = '#1b0b28'; g.strokeText(opts.sub, W/2, by + bh + 34);
  g.fillStyle = '#ffeeb8'; g.fillText(opts.sub, W/2, by + bh + 34);
  g.font = '800 26px "Helvetica Neue", Arial, sans-serif';
  g.lineWidth = 6; g.strokeStyle = '#140820'; g.strokeText(opts.footer, W/2, 1680);
  g.fillStyle = '#f8edf9'; g.fillText(opts.footer, W/2, 1680);
  g.restore();
}
window.renderShortFrame = async (spec) => {
  const img = new Image(); img.src = spec.src; await new Promise(r => img.onload = r);
  const c = document.getElementById('c'), g = c.getContext('2d'), W = 1080, H = 1920;
  g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const sx = img.width * (spec.cropX || 0), sw = img.width * (spec.cropW || 1);
  const sy = img.height * spec.cropTop, sh = img.height * (spec.cropBot - spec.cropTop);
  const destY = spec.padTop || 0, destH = H - destY;
  if (destY > 0) g.drawImage(img, sx, sy, sw, 40, 0, 0, W, destY + 20);
  const scale = Math.max(W / sw, destH / sh), dw = sw * scale, dh = sh * scale;
  g.drawImage(img, sx, sy, sw, sh, (W - dw)/2, destY + (destH - dh) * (spec.anchorY ?? 0.5), dw, dh);
  if (spec.maskBottomCorners) {
    const ml = g.createRadialGradient(185, 1775, 40, 185, 1775, 290);
    ml.addColorStop(0, spec.maskCol); ml.addColorStop(0.55, spec.maskCol); ml.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ml; g.fillRect(0, 1460, 520, 460);
    const mr = g.createRadialGradient(905, 1775, 40, 905, 1775, 290);
    mr.addColorStop(0, spec.maskCol); mr.addColorStop(0.55, spec.maskCol); mr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mr; g.fillRect(560, 1460, 520, 460);
  }
  if (spec.paintBoardBtn) {
    const mb = g.createRadialGradient(915, 1558, 18, 915, 1558, 95);
    mb.addColorStop(0, 'rgba(195,134,68,0.98)'); mb.addColorStop(0.55, 'rgba(182,126,64,0.85)'); mb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mb; g.fillRect(800, 1440, 240, 240);
  }
  drawKeyArtChrome(g, spec.chrome);
  return c.toDataURL('image/png');
};
</script></body>`);

const specs = [
  { file: 'short-1-motel-siege.png', src: srcs.siege, cropTop: 0.042, cropBot: 0.878, padTop: 150, anchorY: 0.38, maskBottomCorners: false,
    chrome: { topCol0: 'rgba(42,18,32,0.94)', topCol1: 'rgba(130,52,58,0.58)', botCol0: 'rgba(20,10,24,0.94)', botCol1: 'rgba(20,10,24,0.50)', badge: 'MOTEL SIEGE', badgeBg0: '#ff4f79', badgeBg1: '#c72656', badgeGlow: 'rgba(255,70,120,0.7)', sub: 'HOLD 3 FLOORS • DROP TRAPS • SWAT BREACH', footer: 'EVERY DOOR, AC UNIT & VENDING MACHINE IS A WEAPON' } },
  { file: 'short-2-sky-pressure.png', src: srcs.pressure, cropTop: 0.045, cropBot: 0.855, padTop: 140, anchorY: 0.3, maskBottomCorners: true, maskCol: 'rgba(14,18,46,0.92)',
    chrome: { topCol0: 'rgba(8,12,34,0.95)', topCol1: 'rgba(16,24,68,0.62)', botCol0: 'rgba(6,10,28,0.95)', botCol1: 'rgba(6,10,28,0.56)', badge: 'SKY PRESSURE', badgeBg0: '#29b6ff', badgeBg1: '#1754c9', badgeGlow: 'rgba(65,190,255,0.72)', sub: '5-STAR HEAT • DODGE THE CHOPPER CONE', footer: 'OUTRUN ROADBLOCKS & SPIKE STRIPS AT DUSK' } },
  { file: 'short-3-wreck-it.png', src: srcs.wreck, cropTop: 0.045, cropBot: 0.98, padTop: 65, anchorY: 0.65, maskBottomCorners: false, paintBoardBtn: true,
    chrome: { topCol0: 'rgba(34,18,22,0.94)', topCol1: 'rgba(110,58,34,0.55)', botCol0: 'rgba(22,12,24,0.92)', botCol1: 'rgba(22,12,24,0.45)', badge: 'WRECK IT!', badgeBg0: '#ff8a2b', badgeBg1: '#d9362b', badgeGlow: 'rgba(255,120,40,0.75)', sub: 'SNAP PALMS • CRUSH PROPS • TOTAL MAYHEM', footer: '4-STAGE DAMAGE FROM FENDER SCUFF TO SMOKING WRECK' } },
  { file: 'short-4-nova-golden.png', src: srcs.nova, cropTop: 0.045, cropBot: 0.845, padTop: 150, anchorY: 0.45, maskBottomCorners: true, maskCol: 'rgba(24,18,36,0.90)',
    chrome: { topCol0: 'rgba(38,16,32,0.94)', topCol1: 'rgba(138,68,48,0.52)', botCol0: 'rgba(20,10,24,0.92)', botCol1: 'rgba(20,10,24,0.46)', badge: 'OPEN GOLDEN CITY', badgeBg0: '#ff3ab2', badgeBg1: '#ff8842', badgeGlow: 'rgba(255,80,175,0.7)', sub: 'NOVA PLAZA • BOARDWALK • ZERO RULES', footer: 'HIJACK, SKATE, OR BURN RUBBER DOWN PALM AVE' } },
];

for (const s of specs) {
  const dataUrl = await page.evaluate((sp) => window.renderShortFrame(sp), s);
  fs.writeFileSync(path.join(OUT, s.file), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
await browser.close();
console.log('Wrote 4 Shorts Key Art frames to', OUT);
