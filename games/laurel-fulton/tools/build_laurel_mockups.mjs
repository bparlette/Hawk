// build_laurel_mockups.mjs — Generates visual proof sheets for Laurel/Fulton TASK G2:
//   1) shots/fleet-lineup.png (all 9 true-scale top-down + 3/4 hero renders)
//   2) shots/g2-pick-player-phone.png (420x860 PICK YOUR PLAYER screen)
//   3) shots/g2-convoy-phone.png (420x860 Convoy presentation with bass rings, underglow, sputter)
// Usage: node tools/build_laurel_mockups.mjs
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_DIR = path.join(ROOT, 'shots', 'fleet-sprites');
const SHOTS = path.join(ROOT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const CARS = [
  { id: 'brad_camaro87',   owner: 'Brad',          street: 'Stansfield Rd',     model: '1987 Chevy Camaro IROC-Z', dims: '4.88 × 1.85 m', tag: '2-TONE · YELLOW LIGHTS · BASS', fx: 'bass_yellow' },
  { id: 'kosack_cavalier', owner: 'Kosack',        street: 'Derby Dr',          model: '~1989 Chevy Cavalier',    dims: '4.43 × 1.68 m', tag: 'RED J-BODY COUPE',              fx: 'none' },
  { id: 'jimmy_astro96',   owner: 'Jimmy',         street: 'Sweet Cherry Ln',   model: '1996 Chevy Astro',        dims: '4.82 × 1.97 m', tag: 'AERO NOSE · BLUE GLOW · BASS',  fx: 'underglow_bass' },
  { id: 'billy_astro94',   owner: 'Billy',         street: 'Sweet Cherry Ln',   model: '1994 Chevy Astro',        dims: '4.75 × 1.96 m', tag: 'TEAL · BOXY 1ST-GEN NOSE',      fx: 'none' },
  { id: 'jason_camry89',   owner: 'Jason',         street: 'Susini Dr',         model: '1989 Toyota Camry V20',   dims: '4.52 × 1.71 m', tag: 'WHITE · NO EXHAUST SPUTTER',    fx: 'sputter' },
  { id: 'clayton_camaro',  owner: 'Clayton Floyd', street: 'Hughes Ave',        model: '3rd-Gen Chevy Camaro',    dims: '4.88 × 1.85 m', tag: 'GREEN · T-TOP F-BODY',          fx: 'none' },
  { id: 'zack_tracer',     owner: 'Zack Floyd',    street: 'Hughes Ave',        model: 'Mercury Tracer',          dims: '4.34 × 1.69 m', tag: 'GREEN · COMPACT HATCH',         fx: 'none' },
  { id: 'rigg_celica71',   owner: 'Rigg',          street: 'Mossy Stone Ct',    model: '1970–73 Toyota Celica',   dims: '4.17 × 1.61 m', tag: 'BLUE LIGHTS · BASS',            fx: 'bass_blue' },
  { id: 'grant_brougham',  owner: 'Grant',         street: 'Early Bud Way',     model: '1990 Cadillac Brougham',  dims: '5.61 × 1.91 m', tag: 'USS MINO · 5.6M LANDAU',        fx: 'none' },
];

for (const c of CARS) {
  c.hero = 'data:image/webp;base64,' + fs.readFileSync(path.join(FLEET_DIR, `${c.id}_hero.webp`)).toString('base64');
  c.sheet = 'data:image/webp;base64,' + fs.readFileSync(path.join(FLEET_DIR, `${c.id}.webp`)).toString('base64');
}

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });

// 1. Fleet Lineup Comparison Sheet
{
  const page = await browser.newPage({ viewport: { width: 1080, height: 840 }, deviceScaleFactor: 2 });
  await page.setContent(`
    <html><body style="margin:0;background:#160b24;font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;padding:20px;">
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-weight:900;font-size:22px;color:#ffd45c;letter-spacing:1px;">LAUREL / FULTON — TRUE-SCALE SIGNATURE FLEET (9 CARS)</div>
        <div style="font-size:12px;color:#6ee2ff;font-weight:700;margin-top:4px;">Blender Cycles Metal GPU · Exact 1:1 Proportions (4.17 m Celica → 5.61 m Cadillac "USS Mino") · Zero House Numbers</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
        ${CARS.map(c => `
          <div style="background:rgba(255,244,214,0.06);border:2px solid rgba(255,212,92,0.45);border-radius:12px;padding:10px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-weight:900;font-size:15px;color:#ffd45c;">${c.owner}</span>
              <span style="font-size:11px;color:#b8acc8;font-weight:700;">${c.street}</span>
            </div>
            <div style="font-size:12px;font-weight:800;color:#fff4de;margin:2px 0 6px;">${c.model} · <span style="color:#6ee2ff;">${c.dims}</span></div>
            <div style="display:flex;align-items:center;gap:8px;background:rgba(16,8,28,0.65);border-radius:8px;padding:6px;">
              <img src="${c.hero}" style="width:176px;height:110px;object-fit:contain;"/>
              <div style="width:110px;height:110px;overflow:hidden;position:relative;border-left:1px solid rgba(255,255,255,0.12);padding-left:6px;">
                <img src="${c.sheet}" style="width:880px;height:440px;position:absolute;left:-214px;top:0px;"/>
              </div>
            </div>
            <div style="margin-top:6px;font-size:10px;font-weight:900;color:#ffd45c;letter-spacing:0.5px;">${c.tag}</div>
          </div>
        `).join('')}
      </div>
    </body></html>
  `);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'fleet-lineup.png'), fullPage: true });
  await page.close();
}

// 2. PICK YOUR PLAYER Phone Mockup (420x860 @2x)
{
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  await page.setContent(`
    <html><body style="margin:0;width:420px;height:860px;overflow:hidden;background:linear-gradient(180deg,#25123d 0%,#160b24 100%);font-family:'Avenir Next',system-ui,sans-serif;color:#fff4de;box-sizing:border-box;padding:16px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:900;font-size:11px;color:#6ee2ff;letter-spacing:1px;">LAUREL / FULTON, MD</div>
        <div style="background:#ffd45c;color:#210f2e;font-weight:900;font-size:10px;padding:3px 8px;border-radius:6px;">RALLY THE CREW</div>
      </div>
      <div style="font-weight:900;font-size:22px;color:#ffd45c;letter-spacing:0.5px;margin-bottom:2px;">PICK YOUR PLAYER</div>
      <div style="font-size:11px;color:#d6cae8;font-weight:600;margin-bottom:10px;">Tap a friend to start in their driveway — collect everyone &amp; meet at Atholton HS.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${CARS.map((c, i) => `
          <div style="background:${i === 0 ? 'rgba(255,212,92,0.16)' : 'rgba(255,244,214,0.06)'};border:2px solid ${i === 0 ? '#ffd45c' : 'rgba(255,244,214,0.22)'};border-radius:10px;padding:7px 8px;${i === 8 ? 'grid-column:1 / -1;display:flex;align-items:center;gap:10px;' : ''}">
            <img src="${c.hero}" style="width:${i === 8 ? '130px' : '100%'};height:${i === 8 ? '66px' : '64px'};object-fit:contain;display:block;margin:0 auto;"/>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px;">
                <span style="font-weight:900;font-size:13px;color:${i === 0 ? '#ffd45c' : '#fff4de'};">${c.owner}</span>
                <span style="font-size:9px;color:#b8acc8;font-weight:700;">${c.street}</span>
              </div>
              <div style="font-size:9.5px;font-weight:800;color:#6ee2ff;margin-top:1px;">${c.tag}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </body></html>
  `);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'g2-pick-player-phone.png') });
  await page.close();
}

// 3. Convoy Presentation Phone Mockup (420x860 @2x)
{
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  await page.setContent(`
    <html><body style="margin:0;width:420px;height:860px;overflow:hidden;background:#160b24;">
      <canvas id="cv" width="840" height="1720" style="width:420px;height:860px;display:block;"></canvas>
      <script>
        const CARS = ${JSON.stringify(CARS)};
        (async () => {
          const cv = document.getElementById('cv');
          const g = cv.getContext('2d');
          g.scale(2, 2);
          // Painted Howard County dusk road & verges
          g.fillStyle = '#2d4628'; g.fillRect(0, 0, 420, 860);
          g.fillStyle = '#393242'; g.fillRect(105, 0, 210, 860);
          g.fillStyle = '#b99c72'; g.fillRect(97, 0, 8, 860); g.fillRect(315, 0, 8, 860);
          // Double yellow center line
          g.fillStyle = '#e5b84b'; g.fillRect(207, 0, 2, 860); g.fillRect(211, 0, 2, 860);

          const imgs = {};
          for (const c of CARS) {
            const i = new Image(); i.src = c.sheet;
            await new Promise(r => i.onload = r);
            imgs[c.id] = i;
          }

          // Draw 6 signature convoy cars heading north (angle idx 8 = north)
          const line = [
            { id: 'brad_camaro87',  x: 256, y: 185, label: 'BRAD (87 CAMARO)', fx: 'yellow_bass' },
            { id: 'jimmy_astro96',  x: 256, y: 305, label: 'JIMMY (96 ASTRO)', fx: 'underglow_bass' },
            { id: 'billy_astro94',  x: 256, y: 425, label: 'BILLY (94 ASTRO)', fx: 'none' },
            { id: 'jason_camry89',  x: 256, y: 545, label: 'JASON (89 CAMRY)', fx: 'sputter' },
            { id: 'rigg_celica71',  x: 256, y: 665, label: 'RIGG (71 CELICA)', fx: 'blue_bass' },
            { id: 'grant_brougham', x: 256, y: 785, label: 'GRANT (USS MINO)', fx: 'none' },
          ];

          for (const item of line) {
            // Headlight cone
            if (item.fx === 'yellow_bass' || item.fx === 'blue_bass' || item.fx === 'underglow_bass') {
              const col = item.fx === 'yellow_bass' ? 'rgba(255,220,90,' : item.fx === 'blue_bass' ? 'rgba(100,190,255,' : 'rgba(255,244,210,';
              const gr = g.createLinearGradient(item.x, item.y - 24, item.x, item.y - 105);
              gr.addColorStop(0, col + '0.45)'); gr.addColorStop(1, col + '0)');
              g.fillStyle = gr;
              g.beginPath(); g.moveTo(item.x - 12, item.y - 22); g.lineTo(item.x + 12, item.y - 22);
              g.lineTo(item.x + 34, item.y - 105); g.lineTo(item.x - 34, item.y - 105); g.closePath(); g.fill();
            }
            // Jimmy blue underglow
            if (item.fx === 'underglow_bass') {
              const ug = g.createRadialGradient(item.x, item.y, 6, item.x, item.y, 44);
              ug.addColorStop(0, 'rgba(54,158,255,0.65)'); ug.addColorStop(1, 'rgba(54,158,255,0)');
              g.fillStyle = ug; g.beginPath(); g.arc(item.x, item.y, 44, 0, 7); g.fill();
            }
            // Bass rings
            if (item.fx.includes('bass')) {
              for (const r of [34, 48]) {
                g.strokeStyle = 'rgba(110,226,255,0.45)'; g.lineWidth = 2;
                g.beginPath(); g.arc(item.x, item.y, r, 0, 7); g.stroke();
              }
            }
            // Jason tailpipe sputter waves
            if (item.fx === 'sputter') {
              g.strokeStyle = 'rgba(235,240,248,0.75)'; g.lineWidth = 2.2;
              for (let k = 0; k < 3; k++) {
                g.beginPath(); g.arc(item.x - 10, item.y + 30 + k * 11, 6 + k * 4, 0.2, Math.PI - 0.2); g.stroke();
              }
            }
            // Draw angle 24 (north, facing up on canvas: i=24 => col 0, row 3)
            // In Blender +X was 0, +Z rotation i*tau/32 => i=8 faces +Y (up in Blender = up on screen? Let's draw angle 8 = col 0 row 1)
            const im = imgs[item.id];
            g.drawImage(im, 0, 160, 160, 160, item.x - 52, item.y - 52, 104, 104);

            // Label plaque left of car
            g.font = '800 9.5px "Avenir Next", system-ui, sans-serif';
            const tw = g.measureText(item.label).width + 12;
            g.fillStyle = 'rgba(24,12,40,0.85)'; g.beginPath(); g.roundRect(16, item.y - 10, tw, 20, 6); g.fill();
            g.strokeStyle = '#ffd45c'; g.lineWidth = 1.4; g.stroke();
            g.fillStyle = '#ffd45c'; g.textAlign = 'left'; g.textBaseline = 'middle';
            g.fillText(item.label, 22, item.y + 0.5);
          }

          // Top HUD bar
          g.fillStyle = 'rgba(24,12,40,0.88)'; g.beginPath(); g.roundRect(14, 14, 392, 46, 10); g.fill();
          g.strokeStyle = '#6ee2ff'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#ffd45c'; g.font = '900 13px "Avenir Next", system-ui, sans-serif';
          g.fillText('RALLY THE CREW · CONVOY 8/8', 26, 31);
          g.fillStyle = '#fff4de'; g.font = '700 11px "Avenir Next", system-ui, sans-serif';
          g.fillText('NEXT: ATHOLTON HIGH SCHOOL MEET-UP', 26, 48);
        })();
      </script>
    </body></html>
  `);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'g2-convoy-phone.png') });
  await page.close();
}

await browser.close();
console.log('LAUREL MOCKUPS BUILT:', SHOTS);
