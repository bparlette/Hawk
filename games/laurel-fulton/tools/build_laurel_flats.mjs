// build_laurel_flats.mjs — TASK G13 (redrawn real-shape flat top-down PNGs matching exact
// showcase-assets/*-sprite.png filenames & dimensions) + TASK G10 v2 lineup & flat-black silhouette sheets.
// Usage: node tools/build_laurel_flats.mjs
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAT_DIR = path.join(ROOT, 'shots', 'flat-sprites-v2');
const FLEET_V2 = path.join(ROOT, 'shots', 'fleet-sprites-v2');
const SIL_DIR = path.join(ROOT, 'shots', 'fleet-silhouettes');
const SHOTS = path.join(ROOT, 'shots');
fs.mkdirSync(FLAT_DIR, { recursive: true });

// Exact filenames & pixel sizes matching showcase-assets/*-sprite.png
const FLATS = [
  { file: 'brad-sprite.png',    id: 'brad_camaro87',   owner: 'Brad',          model: '1987 Chevy Camaro IROC-Z', dims: '4.88×1.85m', w: 294, h: 597, style: 'camaro',     c1: '#f2efe9', c2: '#7d1524', hl: '#ffe055', twotone: true },
  { file: 'clayton-sprite.png', id: 'clayton_camaro',  owner: 'Clayton Floyd', model: '1987 Chevy Camaro IROC-Z', dims: '4.88×1.85m', w: 294, h: 597, style: 'camaro',     c1: '#1c5a37', c2: '#134227', hl: '#fff4d4', twotone: false },
  { file: 'rigg-sprite.png',    id: 'rigg_celica87',   owner: 'Rigg',          model: '1987 Toyota Celica GT',    dims: '4.37×1.71m', w: 272, h: 529, style: 'celica87',   c1: '#215db8', c2: '#184285', hl: '#66ccff', popup: true },
  { file: 'lamar-sprite.png',   id: 'lamar_mustang87', owner: 'Lamar',         model: '1987 Ford Mustang GT',     dims: '4.56×1.75m', w: 285, h: 566, style: 'mustang87',  c1: '#9aa0a8', c2: '#686e76', hl: '#fff4d4', fire: true },
  { file: 'kosack-sprite.png',  id: 'kosack_cavalier', owner: 'Kosack',        model: '1996 Chevy Cavalier',      dims: '4.58×1.72m', w: 278, h: 563, style: 'cavalier96', c1: '#c82026', c2: '#8e1419', hl: '#fff4dc' },
  { file: 'jason-sprite.png',   id: 'jason_camry89',   owner: 'Jason',         model: '1989 Toyota Camry V20',    dims: '4.52×1.71m', w: 279, h: 572, style: 'camry89',    c1: '#ecebe6', c2: '#c8c6be', hl: '#fff4dc' },
  { file: 'zack-sprite.png',    id: 'zack_tracer',     owner: 'Zack Floyd',    model: '1991 Mercury Tracer',      dims: '4.34×1.69m', w: 275, h: 521, style: 'tracer',     c1: '#287243', c2: '#1b502e', hl: '#fff4dc' },
  { file: 'jimmy-sprite.png',   id: 'jimmy_astro96',   owner: 'Jimmy',         model: '1996 Chevy Astro (Aero)',  dims: '4.82×1.97m', w: 307, h: 592, style: 'astro96',    c1: '#c2c7cf', c2: '#949aa4', hl: '#fff6e0' },
  { file: 'billy-sprite.png',   id: 'billy_astro94',   owner: 'Billy',         model: '1994 Chevy Astro (Boxy)',  dims: '4.75×1.96m', w: 305, h: 584, style: 'astro94',    c1: '#1c7a8e', c2: '#135867', hl: '#fff4d8' },
  { file: 'grant-sprite.png',   id: 'grant_brougham',  owner: 'Grant',         model: '1990 Cadillac Brougham',   dims: '5.61×1.91m', w: 301, h: 671, style: 'brougham',   c1: '#6e1624', c2: '#420c15', hl: '#fff4d8' },
];

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: 1 });

await page.setContent(`
<html><body style="margin:0;background:transparent;"><script>
const INK = '#210f2e';
function drawFlatCar(spec) {
  const { w, h, style, c1, c2, hl, twotone, fire, popup } = spec;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const cx = w / 2, padX = 24, padY = 26;
  const bw = w - padX * 2, bh = h - padY * 2;
  const x0 = padX, x1 = w - padX, y0 = padY, y1 = h - padY;

  // Helpers
  const pathBody = (inset = 0) => {
    const ix0 = x0 + inset, ix1 = x1 - inset, iy0 = y0 + inset, iy1 = y1 - inset, iw = ix1 - ix0;
    g.beginPath();
    if (style === 'camaro') {
      // Tapered pointed nosecone -> wide front fender hips -> tucked waist -> wide rear haunches -> tapered tail
      g.moveTo(cx, iy0);
      g.bezierCurveTo(cx + iw * 0.34, iy0 + 2, ix1 - 6, iy0 + 28, ix1, iy0 + 95);
      g.lineTo(ix1 - 2, iy1 - 56);
      g.quadraticCurveTo(ix1 - 4, iy1 - 6, ix1 - 22, iy1);
      g.lineTo(ix0 + 22, iy1);
      g.quadraticCurveTo(ix0 + 4, iy1 - 6, ix0 + 2, iy1 - 56);
      g.lineTo(ix0, iy0 + 95);
      g.bezierCurveTo(ix0 + 6, iy0 + 28, cx - iw * 0.34, iy0 + 2, cx, iy0);
    } else if (style === 'celica87') {
      // Sleek 4th-gen ST162 angular wedge liftback
      g.moveTo(cx, iy0);
      g.bezierCurveTo(cx + iw * 0.32, iy0 + 2, ix1 - 10, iy0 + 22, ix1, iy0 + 82);
      g.lineTo(ix1 - 4, iy1 - 48);
      g.quadraticCurveTo(ix1 - 6, iy1 - 4, ix1 - 24, iy1);
      g.lineTo(ix0 + 24, iy1);
      g.quadraticCurveTo(ix0 + 6, iy1 - 4, ix0 + 4, iy1 - 48);
      g.lineTo(ix0, iy0 + 82);
      g.bezierCurveTo(ix0 + 10, iy0 + 22, cx - iw * 0.32, iy0 + 2, cx, iy0);
    } else if (style === 'mustang87') {
      // Fox-body wedge hatch + ground effects
      g.moveTo(cx, iy0 + 2);
      g.quadraticCurveTo(ix1 - 12, iy0 + 6, ix1 - 2, iy0 + 42);
      g.lineTo(ix1, iy1 - 28);
      g.quadraticCurveTo(ix1 - 4, iy1 - 2, ix1 - 18, iy1);
      g.lineTo(ix0 + 18, iy1);
      g.quadraticCurveTo(ix0 + 4, iy1 - 2, ix0, iy1 - 28);
      g.lineTo(ix0 + 2, iy0 + 42);
      g.quadraticCurveTo(ix0 + 12, iy0 + 6, cx, iy0 + 2);
    } else if (style === 'cavalier96') {
      // Rounded '96 3rd-gen aero compact sedan
      g.moveTo(cx, iy0);
      g.bezierCurveTo(cx + iw * 0.38, iy0 + 2, ix1 - 4, iy0 + 26, ix1, iy0 + 80);
      g.lineTo(ix1 - 2, iy1 - 42);
      g.quadraticCurveTo(ix1 - 8, iy1 - 2, ix1 - 28, iy1);
      g.lineTo(ix0 + 28, iy1);
      g.quadraticCurveTo(ix0 + 8, iy1 - 2, ix0 + 2, iy1 - 42);
      g.lineTo(ix0, iy0 + 80);
      g.bezierCurveTo(ix0 + 4, iy0 + 26, cx - iw * 0.38, iy0 + 2, cx, iy0);
    } else if (style === 'brougham') {
      // Long upright formal Cadillac slab
      g.roundRect(ix0, iy0, iw, iy1 - iy0, [14, 14, 10, 10]);
    } else if (style === 'astro96') {
      // Rounded aero van nose
      g.roundRect(ix0, iy0, iw, iy1 - iy0, [34, 34, 14, 14]);
    } else if (style === 'astro94') {
      // Blunt boxy 1st-gen van
      g.roundRect(ix0, iy0, iw, iy1 - iy0, [14, 14, 12, 12]);
    } else {
      // Camry V20 / Tracer: clean rounded 3-box / compact hatch
      g.roundRect(ix0, iy0, iw, iy1 - iy0, [22, 22, 16, 16]);
    }
    g.closePath();
  };

  // Soft drop shadow
  g.save();
  g.shadowColor = 'rgba(18,10,28,0.48)';
  g.shadowBlur = 14;
  g.shadowOffsetX = 6;
  g.shadowOffsetY = 8;
  pathBody(0);
  g.fillStyle = '#000';
  g.fill();
  g.restore();

  // Tires protruding subtly at wheel arches
  g.fillStyle = '#18141e';
  const wy1 = y0 + bh * 0.18, wy2 = y0 + bh * 0.72, wh = 64;
  for (const wy of [wy1, wy2]) {
    g.beginPath(); g.roundRect(x0 - 6, wy, 12, wh, 4); g.fill();
    g.beginPath(); g.roundRect(x1 - 6, wy, 12, wh, 4); g.fill();
  }

  // Side mirrors
  const mirY = y0 + bh * (style.startsWith('astro') ? 0.22 : 0.34);
  for (const mx of [x0 - 11, x1 - 3]) {
    g.fillStyle = c1; g.strokeStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(mx, mirY, 14, 22, 5); g.fill(); g.stroke();
  }

  // Main painted body with subtle metallic shading gradient
  g.save();
  pathBody(0);
  g.clip();
  const bodyGrad = g.createLinearGradient(x0, 0, x1, 0);
  bodyGrad.addColorStop(0, c2);
  bodyGrad.addColorStop(0.25, c1);
  bodyGrad.addColorStop(0.55, c1);
  bodyGrad.addColorStop(1, c2);
  g.fillStyle = bodyGrad;
  g.fillRect(x0, y0, bw, bh);

  // Two-tone split on Brad's '87 Camaro (white front / maroon rear)
  if (twotone) {
    g.fillStyle = c2;
    g.fillRect(x0, y0 + bh * 0.44, bw, bh * 0.56);
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, y0 + bh * 0.44); g.lineTo(x1, y0 + bh * 0.44); g.stroke();
  }

  // Hood crease lines flowing INTO the nose silhouette (no square blocks!)
  g.strokeStyle = 'rgba(33,15,46,0.35)'; g.lineWidth = 2.2;
  const hoodY0 = y0 + 20, hoodY1 = y0 + bh * (style.startsWith('astro') ? 0.16 : 0.36);
  g.beginPath();
  g.moveTo(cx - bw * 0.24, hoodY1);
  g.quadraticCurveTo(cx - bw * 0.22, (hoodY0 + hoodY1) * 0.5, cx - bw * 0.15, hoodY0);
  g.moveTo(cx + bw * 0.24, hoodY1);
  g.quadraticCurveTo(cx + bw * 0.22, (hoodY0 + hoodY1) * 0.5, cx + bw * 0.15, hoodY0);
  g.stroke();

  // Camaro recessed tapered hood louvers (flowing along the wedge!)
  if (style === 'camaro') {
    for (const side of [-1, 1]) {
      g.save();
      g.fillStyle = '#1f1c26'; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + side * 14, y0 + 82);
      g.lineTo(cx + side * 52, y0 + 82);
      g.lineTo(cx + side * 46, y0 + 138);
      g.lineTo(cx + side * 14, y0 + 138);
      g.closePath();
      g.fill(); g.stroke();
      g.strokeStyle = '#4a4658'; g.lineWidth = 2;
      for (let ly = y0 + 92; ly <= y0 + 130; ly += 9) {
        g.beginPath(); g.moveTo(cx + side * 18, ly); g.lineTo(cx + side * 44, ly); g.stroke();
      }
      g.restore();
    }
  } else if (style === 'mustang87') {
    // Mustang GT twin hood vents
    for (const side of [-1, 1]) {
      g.fillStyle = '#26232e'; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.roundRect(cx + side * 28 - 14, y0 + 88, 28, 42, 6); g.fill(); g.stroke();
    }
  } else if (style === 'brougham') {
    // Chrome center hood spear + crest
    g.fillStyle = '#e6eaf0';
    g.fillRect(cx - 2, y0 + 18, 4, bh * 0.30);
    g.beginPath(); g.arc(cx, y0 + 20, 5, 0, 7); g.fill();
  }

  // Greenhouse / Windshield / Roof / Rear Glass (all following body curves!)
  const wsTop = y0 + bh * (style.startsWith('astro') ? 0.14 : style === 'brougham' ? 0.37 : 0.34);
  const roofTop = wsTop + bh * (style.startsWith('astro') ? 0.11 : 0.14);
  const roofBot = y0 + bh * (style.startsWith('astro') ? 0.90 : style === 'tracer' ? 0.84 : style === 'camaro' || style === 'celica87' || style === 'mustang87' ? 0.68 : 0.72);
  const rearBot = y0 + bh * (style.startsWith('astro') ? 0.96 : style === 'camaro' || style === 'celica87' || style === 'mustang87' ? 0.90 : 0.86);

  // Dark tinted wraparound glass base
  g.fillStyle = '#1d2738'; g.strokeStyle = INK; g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(x0 + 24, wsTop);
  g.quadraticCurveTo(cx, wsTop - 10, x1 - 24, wsTop);
  g.lineTo(x1 - 20, rearBot);
  g.quadraticCurveTo(cx, rearBot + 6, x0 + 20, rearBot);
  g.closePath();
  g.fill(); g.stroke();

  // Specular sky reflection diagonal across windshield & rear window
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(160,210,245,0.28)'; g.lineWidth = 14;
  g.beginPath(); g.moveTo(x0, wsTop + 50); g.lineTo(x1, wsTop - 10); g.stroke();
  g.beginPath(); g.moveTo(x0, rearBot); g.lineTo(x1, rearBot - 70); g.stroke();
  g.restore();

  // Roof panel over the greenhouse
  const roofFill = twotone ? c2 : style === 'brougham' ? '#3a0a12' : c1;
  g.fillStyle = roofFill; g.strokeStyle = INK; g.lineWidth = 2.4;
  g.beginPath();
  g.roundRect(x0 + 30, roofTop, bw - 60, roofBot - roofTop, 10);
  g.fill(); g.stroke();

  // Camaro T-Top glass inserts
  if (style === 'camaro') {
    g.fillStyle = '#161f2e'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x0 + 38, roofTop + 8, (bw - 88) / 2, roofBot - roofTop - 16, 4); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(cx + 6, roofTop + 8, (bw - 88) / 2, roofBot - roofTop - 16, 4); g.fill(); g.stroke();
  }
  // Astro 96 roof rack
  if (style === 'astro96') {
    g.strokeStyle = '#25222e'; g.lineWidth = 5;
    g.strokeRect(x0 + 44, roofTop + 16, bw - 88, roofBot - roofTop - 32);
    for (let ry = roofTop + 50; ry < roofBot - 40; ry += 72) {
      g.beginPath(); g.moveTo(x0 + 44, ry); g.lineTo(x1 - 44, ry); g.stroke();
    }
  }
  // Brougham front painted roof half vs rear padded landau
  if (style === 'brougham') {
    g.fillStyle = c1;
    g.fillRect(x0 + 32, roofTop + 2, bw - 64, (roofBot - roofTop) * 0.48);
  }

  // Headlights (recessed quads / pop-up pods / flush aero)
  for (const side of [-1, 1]) {
    const hx = side < 0 ? x0 + 22 : x1 - 62;
    if (popup) {
      // '87 Celica GT pop-up headlight blisters
      g.fillStyle = c2; g.strokeStyle = INK; g.lineWidth = 2.2;
      g.beginPath(); g.roundRect(hx, y0 + 18, 40, 26, 4); g.fill(); g.stroke();
      g.fillStyle = hl; g.fillRect(hx + 4, y0 + 14, 32, 8);
    } else {
      g.fillStyle = hl; g.strokeStyle = INK; g.lineWidth = 2;
      g.beginPath(); g.roundRect(hx, y0 + 6, 40, 12, 3); g.fill(); g.stroke();
    }
    // Taillights
    g.fillStyle = '#d82028'; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.roundRect(hx, y1 - 14, 42, 10, 3); g.fill(); g.stroke();
  }

  // Camaro / Mustang rear wing
  if (style === 'camaro' || style === 'mustang87') {
    g.fillStyle = twotone ? c2 : c1; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.roundRect(x0 + 14, y1 - 24, bw - 28, 12, 4); g.fill(); g.stroke();
  }

  // Lamar's Mustang GT ON FIRE!
  if (fire) {
    for (const [fx, fy, fr] of [[cx - 10, y0 + 95, 42], [cx + 22, y0 + 125, 36], [cx - 24, y0 + 140, 32], [cx + 6, y0 + 68, 28]]) {
      const fg = g.createRadialGradient(fx, fy, 4, fx, fy, fr);
      fg.addColorStop(0, 'rgba(255,245,140,0.95)');
      fg.addColorStop(0.5, 'rgba(255,105,20,0.85)');
      fg.addColorStop(1, 'rgba(255,40,0,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(fx, fy, fr, 0, 7); g.fill();
    }
  }
  g.restore();

  // Crisp #210f2e outer ink contour
  pathBody(0);
  g.strokeStyle = INK; g.lineWidth = 3.2; g.stroke();

  return cv.toDataURL('image/png');
}
window.drawFlatCar = drawFlatCar;
</script></body></html>
`);

// 1. Generate all 10 redrawn flat sprites (Task G13)
for (const spec of FLATS) {
  const url = await page.evaluate((s) => window.drawFlatCar(s), spec);
  fs.writeFileSync(path.join(FLAT_DIR, spec.file), Buffer.from(url.split(',')[1], 'base64'));
}

// 2. Generate G13 True-Scale Flat Sprites Contact Sheet (shots/flat-lineup-v2.png)
{
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
  await p2.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:20px;">
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-weight:900;font-size:22px;color:#ffd45c;">TASK G13 — REDRAWN FLAT TOP-DOWN SPRITES (REAL SHAPES, NO SQUARE HOODS)</div>
        <div style="font-size:12px;color:#6ee2ff;font-weight:700;margin-top:4px;">Exact Showcase Dimensions &amp; Filenames · Tapered Wedges, Flow-In Louvers, Pop-Ups, Flames</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
        ${FLATS.map(s => {
          const b64 = 'data:image/png;base64,' + fs.readFileSync(path.join(FLAT_DIR, s.file)).toString('base64');
          return `
            <div style="background:rgba(255,244,214,0.06);border:2px solid rgba(255,212,92,0.4);border-radius:10px;padding:10px;text-align:center;">
              <div style="font-weight:900;font-size:13px;color:#ffd45c;">${s.owner}</div>
              <div style="font-size:10px;color:#fff4de;font-weight:700;margin-bottom:6px;">${s.model}</div>
              <div style="height:210px;display:flex;align-items:center;justify-content:center;background:#e8dcc0;border-radius:8px;padding:6px;">
                <img src="${b64}" style="max-height:198px;width:auto;display:block;"/>
              </div>
              <div style="font-size:9.5px;color:#6ee2ff;font-weight:800;margin-top:6px;">${s.file} (${s.w}×${s.h})</div>
            </div>
          `;
        }).join('')}
      </div>
    </body></html>
  `);
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: path.join(SHOTS, 'flat-lineup-v2.png'), fullPage: true });
  await p2.close();
}

// 3. Generate G10 Acceptance Test: Flat-Black Silhouette Sheet (NO COLOR, NO LABELS on silhouettes!)
if (fs.existsSync(SIL_DIR)) {
  const p3 = await browser.newPage({ viewport: { width: 1220, height: 640 }, deviceScaleFactor: 2 });
  await p3.setContent(`
    <html><body style="margin:0;background:#f6e6c4;font-family:'Avenir Next',system-ui,sans-serif;color:#210f2e;padding:22px;">
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-weight:900;font-size:20px;letter-spacing:1px;">G10 ACCEPTANCE TEST — FLAT BLACK SILHOUETTES (NO COLOR · NO LABELS)</div>
        <div style="font-size:11px;font-weight:700;color:#4a345c;margin-top:3px;">10 Laurel/Fulton Cars at Exact 1:1 Scale — Side Profile + Plan Outline</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;">
        ${FLATS.map(s => {
          const sideB64 = 'data:image/png;base64,' + fs.readFileSync(path.join(SIL_DIR, `${s.id}_side.png`)).toString('base64');
          const topB64  = 'data:image/png;base64,' + fs.readFileSync(path.join(SIL_DIR, `${s.id}_top.png`)).toString('base64');
          return `
            <div style="border:2px solid rgba(33,15,46,0.2);border-radius:10px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:8px;background:rgba(255,255,255,0.35);">
              <img src="${sideB64}" style="width:200px;height:84px;object-fit:contain;filter:brightness(0);"/>
              <img src="${topB64}"  style="width:130px;height:130px;object-fit:contain;filter:brightness(0);"/>
            </div>
          `;
        }).join('')}
      </div>
    </body></html>
  `);
  await p3.waitForTimeout(300);
  await p3.screenshot({ path: path.join(SHOTS, 'fleet-silhouettes-v2.png'), fullPage: true });
  await p3.close();
}

// 4. Generate G10 Lineup v2 (all 10 Blender v2 cars w/ 3/4 + top-down)
{
  const p4 = await browser.newPage({ viewport: { width: 1260, height: 680 }, deviceScaleFactor: 2 });
  await p4.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:20px;">
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-weight:900;font-size:22px;color:#ffd45c;">TASK G10 — FLEET RENDER REVISION V2: TRUE SILHOUETTES (10 CARS)</div>
        <div style="font-size:12px;color:#6ee2ff;font-weight:700;margin-top:4px;">Added Lamar '87 Mustang GT (On Fire) · Corrected Rigg ('87 Celica GT) &amp; Kosack ('96 Cavalier)</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
        ${FLATS.map(s => {
          const hero = 'data:image/webp;base64,' + fs.readFileSync(path.join(FLEET_V2, `${s.id}_hero.webp`)).toString('base64');
          const top  = 'data:image/png;base64,'  + fs.readFileSync(path.join(SIL_DIR, `${s.id}_top.png`)).toString('base64');
          return `
            <div style="background:rgba(255,244,214,0.06);border:2px solid rgba(255,212,92,0.45);border-radius:10px;padding:8px;">
              <div style="font-weight:900;font-size:13px;color:#ffd45c;">${s.owner}</div>
              <div style="font-size:10.5px;font-weight:800;color:#fff4de;">${s.model}</div>
              <div style="font-size:9.5px;color:#6ee2ff;font-weight:700;margin-bottom:4px;">${s.dims}</div>
              <div style="background:rgba(16,8,28,0.7);border-radius:8px;padding:4px;text-align:center;">
                <img src="${hero}" style="width:190px;height:118px;object-fit:contain;display:block;margin:0 auto;"/>
                <img src="${top}"  style="width:105px;height:105px;object-fit:contain;display:block;margin:0 auto;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;"/>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </body></html>
  `);
  await p4.waitForTimeout(300);
  await p4.screenshot({ path: path.join(SHOTS, 'fleet-lineup-v2.png'), fullPage: true });
  await p4.close();
}

await browser.close();
console.log('G10 + G13 SHEETS BUILT:', SHOTS);
