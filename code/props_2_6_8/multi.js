// node multi.js <level> plan.json : steps {until?, js?, wait?, shot?}
const { chromium } = require('playwright');
const fs = require('fs');
const [lvl, planf] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planf, 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs = 0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error' || /hook error/.test(m.text())) { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/props_2_6_8/test/index.html?debug&nocache&level=' + lvl);
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__SS && __SS.STATE.scene === 'stage' && __SS.STATE.player && !(__SS.STATE.cardT > 0), null, { timeout: 30000 });
  await pg.waitForTimeout(600);
  for (const s of plan) {
    if (s.until) { let ok = false; for (let i = 0; i < (s.tries || 400); i++) { if (s.tick) await pg.evaluate(s.tick); if (await pg.evaluate(s.until)) { ok = true; break; } await pg.waitForTimeout(100); } if (!ok) console.log('UNTIL-TIMEOUT', s.until); }
    if (s.js) { const r = await pg.evaluate(s.js); if (r !== undefined) console.log('js->', JSON.stringify(r)); }
    if (s.wait) await pg.waitForTimeout(s.wait);
    if (s.shot) { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(s.shot, Buffer.from(d.split(',')[1], 'base64')); console.log('shot', s.shot); }
  }
  console.log('ERRORS', errs);
  await b.close();
})();
