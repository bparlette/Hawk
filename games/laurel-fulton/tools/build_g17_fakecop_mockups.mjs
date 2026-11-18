// build_g17_fakecop_mockups.mjs — Task G17: Kosack's Fake-Cop Pull-Over Minigame Storyboard
// Captures real Scaggsville dusk frame near Derby Drive (12576,-1474) at 420x860 @2x and composites
// the 3-panel G17 phone storyboard into shots/g17-fake-cop/g17-fakecop-phone.png.
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES = path.resolve(ROOT, '..');
const OUT = path.join(ROOT, 'shots', 'g17-fake-cop');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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

// 1. Capture live Scaggsville dusk canvas at Derby Dr / Scaggsville intersection
const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.goto(`http://localhost:${PORT}/laurel-fulton/play.html?cam=12540,-1380,0.78&t=0.82`);
await page.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes && window.__lf.areas.heroes.length >= 10, null, { timeout: 180000 });
await page.waitForFunction(() => {
  const g = window.__lf.ground, CH = 256, hw = 210 / 0.78, hh = 430 / 0.78, cx = 12540, cy = -1380;
  for (let gy = Math.floor((cy - hh) / CH); gy <= Math.floor((cy + hh) / CH); gy++)
    for (let gx = Math.floor((cx - hw) / CH); gx <= Math.floor((cx + hw) / CH); gx++) {
      const c = g.cache.get(gx + ',' + gy);
      if (!c) return false;
      const st = g.painted ? g.paintedState(gx, gy) : null;
      if (st === 'loading') return false;
      if (st === 'ok' && !c._pt) return false;
    }
  return true;
}, null, { timeout: 180000 });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'bg-derby-dusk.png') });
await page.close();

// 2. Render 3-panel 420x860 phone storyboard in Canvas over the real dusk plate
const bgData = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'bg-derby-dusk.png')).toString('base64');
const FLEET = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/fleet.json')));
const b64Car = (model) => {
  const full = path.join(ROOT, 'assets', FLEET[model].color.file);
  if (!fs.existsSync(full)) throw new Error('Missing car sprite: ' + full);
  return 'data:image/webp;base64,' + fs.readFileSync(full).toString('base64');
};
const kosackCar = b64Car('cavalier_kosack');
const jasonCar = b64Car('camry_jason');
const zackCar = b64Car('tracer_zack');

const PANEL_SCRIPT = `
window.makePanel = async (mode, bgSrc, carASrc, carBSrc, carCSrc) => {
  const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = src; });
  const [bg, cKosack, cSilver, cGreen] = await Promise.all([load(bgSrc), load(carASrc), load(carBSrc), load(carCSrc)]);
  const cv = document.createElement('canvas'); cv.width = 420; cv.height = 860;
  const g = cv.getContext('2d');
  const INK = '#210f2e';
  g.drawImage(bg, 0, 0, 420, 860);
  // Subtle road-lane darkening for dramatic dusk pop
  g.fillStyle = 'rgba(18,12,34,0.22)'; g.fillRect(0, 0, 420, 860);

  const drawSpriteCar = (img, x, y, ang, scale = 1.0) => {
    const fw = img.width / 8, fh = img.height / 4;
    let a = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(a / (Math.PI * 2) * 32) % 32;
    const col = idx % 8, row = Math.floor(idx / 8);
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(16,10,24,0.45)'; g.beginPath(); g.ellipse(4, 5, 22 * scale, 11 * scale, ang, 0, Math.PI * 2); g.fill();
    g.drawImage(img, col * fw, row * fh, fw, fh, -36 * scale, -36 * scale, 72 * scale, 72 * scale);
    g.restore();
  };

  const drawCopStrobes = (x, y, ang, redLeft = true) => {
    const fx = Math.cos(ang), fy = Math.sin(ang), px = -fy, py = fx;
    g.save(); g.globalCompositeOperation = 'lighter';
    // Red & Blue alternating forward headlight + visor wash
    const cL = redLeft ? 'rgba(255,46,56,' : 'rgba(56,130,255,';
    const cR = redLeft ? 'rgba(56,130,255,' : 'rgba(255,46,56,';
    for (const [side, col] of [[-1, cL], [1, cR]]) {
      const ox = x + fx * 18 + px * side * 7, oy = y + fy * 18 + py * side * 7;
      const tx = ox + fx * 98, ty = oy + fy * 98;
      const gr = g.createLinearGradient(ox, oy, tx, ty);
      gr.addColorStop(0, col + '0.88)'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(ox + px * 2.5, oy + py * 2.5); g.lineTo(ox - px * 2.5, oy - py * 2.5);
      g.lineTo(tx - px * 14, ty - py * 14); g.lineTo(tx + px * 14, ty + py * 14); g.closePath(); g.fill();
      // Interior visor dash core bulbs
      const vx = x + fx * 7 + px * side * 4.5, vy = y + fy * 7 + py * side * 4.5;
      const vg = g.createRadialGradient(vx, vy, 1, vx, vy, 20);
      vg.addColorStop(0, col + '0.98)'); vg.addColorStop(1, col + '0)');
      g.fillStyle = vg; g.beginPath(); g.arc(vx, vy, 20, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // Sharp bulb rects inside windshield
    for (const [side, hex] of [[-1, redLeft ? '#ff3b45' : '#4fa0ff'], [1, redLeft ? '#4fa0ff' : '#ff3b45']]) {
      const vx = x + fx * 7 + px * side * 4.5, vy = y + fy * 7 + py * side * 4.5;
      g.fillStyle = hex; g.strokeStyle = INK; g.lineWidth = 1.4;
      g.beginPath(); g.arc(vx, vy, 3.2, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  };

  const pill = (x, y, text, fill = 'rgba(255,244,220,0.96)', col = INK) => {
    g.font = '800 12px system-ui';
    const w = Math.min(370, g.measureText(text).width + 24);
    const px = Math.max(w / 2 + 12, Math.min(408 - w / 2, x));
    g.fillStyle = fill; g.beginPath(); g.roundRect(px - w / 2, y - 28, w, 28, 12); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.fillText(text, px, y - 10);
  };

  const toast = (title, sub, accent = '#ffd25c') => {
    g.fillStyle = 'rgba(27,20,48,0.94)'; g.beginPath(); g.roundRect(42, 92, 336, 56, 14); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
    // Fake cop red/blue end bars
    g.fillStyle = '#ff2e38'; g.beginPath(); g.roundRect(46, 98, 7, 44, 4); g.fill();
    g.fillStyle = '#3882ff'; g.beginPath(); g.roundRect(367, 98, 7, 44, 4); g.fill();
    g.textAlign = 'center'; g.fillStyle = accent; g.font = '900 16px system-ui'; g.fillText(title, 210, 118);
    g.fillStyle = '#fff1d8'; g.font = '700 11px system-ui'; g.fillText(sub, 210, 138);
  };

  // Screen layout per mode
  const roadAng = -1.25;
  if (mode === 'lock') {
    const kx = 176, ky = 528, tx = 212, ty = 398;
    // Target lock ring filling clockwise
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,46,56,0.92)';
    g.beginPath(); g.arc(tx, ty, 38, -Math.PI / 2, Math.PI * 0.75); g.stroke();
    g.strokeStyle = 'rgba(56,130,255,0.92)'; g.setLineDash([6, 4]);
    g.beginPath(); g.arc(tx, ty, 44, Math.PI * 0.75, Math.PI * 1.5); g.stroke(); g.setLineDash([]);
    drawSpriteCar(cSilver, tx, ty, roadAng, 1.05);
    drawCopStrobes(kx, ky, roadAng, true);
    drawSpriteCar(cKosack, kx, ky, roadAng, 1.10);
    pill(tx + 34, ty - 48, 'HESITATING... (0.9s)', 'rgba(27,20,48,0.88)', '#7de2ff');
    pill(kx + 18, ky + 62, 'WOOP-WOOP! (620–980 Hz)', '#ff3b45', '#fff8ec');
    toast('FAKE COP · TARGET LOCKING', 'Close within 140 wu & tap SIREN', '#7de2ff');
  } else if (mode === 'pullover') {
    const kx = 178, ky = 478, tx = 236, ty = 438;
    // Hazard flashers on pulled-over target
    for (const [dx, dy] of [[12, -20], [-10, -24]]) {
      g.fillStyle = 'rgba(255,180,46,0.88)'; g.beginPath(); g.arc(tx + dx, ty + dy, 5, 0, Math.PI * 2); g.fill();
    }
    drawSpriteCar(cSilver, tx, ty, roadAng + 0.14, 1.05);
    drawCopStrobes(kx, ky, roadAng + 0.05, false);
    drawSpriteCar(cKosack, kx, ky, roadAng + 0.05, 1.10);
    pill(tx, ty - 42, '“Wait... you’re 17 in a Cavalier?!”');
    pill(kx - 16, ky + 64, '“License & registration—nah I’m messing!”');
    toast('+500 FAKE STOP · STREAK ×2', 'ZERO WANTED STARS · NOT ACTUALLY A COP', '#ffd25c');
  } else {
    // Peel-off bluff
    const kx = 176, ky = 540, tx = 222, ty = 325;
    // Smoke puffs behind peeling-off car
    for (let i = 0; i < 4; i++) {
      g.fillStyle = \`rgba(236,232,245,\${0.55 - i * 0.11})\`;
      g.beginPath(); g.arc(tx - 10 - i * 7, ty + 28 + i * 16, 10 + i * 3, 0, Math.PI * 2); g.fill();
    }
    drawSpriteCar(cGreen, tx, ty, roadAng, 1.05);
    drawCopStrobes(kx, ky, roadAng, true);
    drawSpriteCar(cKosack, kx, ky, roadAng, 1.10);
    pill(tx, ty - 38, '“Bro, that’s a RadioShack visor light! Later!”');
    toast('+100 BUSTED BLUFF · 1.35× ESCAPE', '30% bold drivers call your fake siren', '#ff9a8a');
  }

  // Siren action button bottom right
  g.fillStyle = 'rgba(255,46,56,0.28)'; g.beginPath(); g.arc(360, 745, 34, 0, Math.PI * 2); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#4fa0ff'; g.stroke();
  g.fillStyle = '#fff4de'; g.font = '900 12px system-ui'; g.textAlign = 'center'; g.fillText('SIREN', 360, 749);
  g.fillStyle = 'rgba(27,20,48,0.82)'; g.beginPath(); g.roundRect(14, 14, 152, 28, 12); g.fill();
  g.fillStyle = '#ff6d75'; g.font = '900 12px system-ui'; g.fillText('CAVALIER · STROBE ON', 90, 32);
  return cv.toDataURL('image/png');
};
`;

const p2 = await browser.newPage();
await p2.setContent('<html><body></body></html>');
await p2.addScriptTag({ content: PANEL_SCRIPT });

const frames = [
  ['panel-1-lock.png', 'lock', '1. ALWAYS-ON VISOR STROBE & TAIL LOCK'],
  ['panel-2-pullover.png', 'pullover', '2. KERB PULL-OVER + BARK & +500 STREAK'],
  ['panel-3-peeloff.png', 'peeloff', '3. 30% BLUFF CALL-OUT (+100 BLUFF)'],
];
for (const [file, mode] of frames) {
  const url = await p2.evaluate(({ mode, bgData, kosackCar, jasonCar, zackCar }) => window.makePanel(mode, bgData, kosackCar, jasonCar, zackCar), { mode, bgData, kosackCar, jasonCar, zackCar });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(url.split(',')[1], 'base64'));
}
await p2.close();

const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64');
const comp = await browser.newPage({ viewport: { width: 1360, height: 960 }, deviceScaleFactor: 1 });
await comp.setContent(`
  <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:18px;">
    <div style="text-align:center;font-weight:900;font-size:20px;color:#ffd45c;margin-bottom:6px;">
      TASK G17 — KOSACK’S FAKE-COP PULL-OVER MINIGAME (420×860 PHONE STORYBOARD)
    </div>
    <div style="text-align:center;font-size:12px;color:#6ee2ff;margin-bottom:14px;">
      Always-On 6.4 Hz Red/Blue Strobe · 620–980 Hz Yelp/Wail · Just Lights & Sound (Zero Real Authority)
    </div>
    <div style="display:flex;gap:16px;justify-content:center;">
      ${frames.map(([f, , lbl]) => `
        <div style="text-align:center;width:420px;">
          <div style="font-size:12px;font-weight:800;color:#7dffa8;margin-bottom:4px;">${lbl}</div>
          <img src="${b64(f)}" style="width:420px;height:860px;border:2px solid #ffd45c;border-radius:10px;display:block;"/>
        </div>
      `).join('')}
    </div>
  </body></html>
`);
await comp.waitForTimeout(300);
await comp.screenshot({ path: path.join(OUT, 'g17-fakecop-phone.png'), fullPage: true });
await comp.close();
await browser.close();
web.close();
console.log('G17 MOCKUP COMPLETE: shots/g17-fake-cop/g17-fakecop-phone.png');
