// node multi.js plan.json : sequence of {js?, wait, shot?}
const { chromium } = require('playwright');
const plan = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text()); });
  await pg.goto('file:///workspace/work/lvl10_test/index.html?debug&nocache&level=10');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(5200);
  for (const s of plan) {
    if (s.until) { for (let i = 0; i < 300; i++) { if (await pg.evaluate(s.until)) break; await pg.waitForTimeout(100); } }
    if (s.down) await pg.keyboard.down(s.down);
    if (s.up) await pg.keyboard.up(s.up);
    if (s.js) { const r = await pg.evaluate(s.js); if (r !== undefined) console.log('js->', JSON.stringify(r)); }
    if (s.wait) await pg.waitForTimeout(s.wait);
    if (s.shot) { const d = await pg.evaluate(() => document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(s.shot, Buffer.from(d.split(',')[1], 'base64')); console.log('shot', s.shot); }
  }
  await b.close();
})();
