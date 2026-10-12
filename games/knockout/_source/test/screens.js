const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch(); const c = await b.newContext({ viewport: { width: 1024, height: 768 } }); const p = await c.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8947/'); await p.waitForTimeout(1500);
  await p.locator('#screen').screenshot({ path: __dirname + '/x_title.png' });
  await p.evaluate(() => { __ko.S.scene = 'tip'; __ko.S.st = 0; }); await p.waitForTimeout(3000);
  await p.locator('#screen').screenshot({ path: __dirname + '/x_tip.png' });
  // fight states gallery
  await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
  for (const [st, atk, t, hs] of [['windup', 'upper', 0.8, 'idle'], ['windup', 'hay', 0.6, 'duck'], ['dizzy', 'hook', 0.3, 'punch'], ['taunt', 'hook', 0.4, 'dodge'], ['down', 'hook', 0.3, 'idle'], ['miss','hook',0.1,'idle']]) {
    await p.evaluate(([st, atk, t, hs]) => { const S = __ko.S; S.hold = false; const o = S.opp; o.state = st; o.atk = atk; o.t = t; o.dur = st === 'windup' ? __ko.ATK[atk].wind : 2; if (st === 'down') { S.count = { who: 'opp', n: 3, t: 0, target: 5, getUp: true }; S.ref.vis = true; S.ref.x = 14; } if (st==='taunt') o.bubble={text:'LOVE YA, MA!',t:2}; const h = S.hero; h.state = hs; h.t = 0.1; h.dur = 0.5; h.side = -1; h.head = true; h.hand='R'; S.hold = true; }, [st, atk, t, hs]);
    await p.waitForTimeout(300);
    await p.locator('#screen').screenshot({ path: __dirname + `/x_${st}_${atk}.png` });
  }
  console.log('errs', errs);
  await b.close();
})();
