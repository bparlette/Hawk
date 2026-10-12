// node shots.js <prefix> [w h]  -> captures named canvas shots
const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const [pre = '/tmp/hm_', w = '1024', h = '768', only = ''] = process.argv.slice(2);
  const b = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const mob = +w < 600; const errs = [];
  const run = async (name, q, steps) => {
    if (only && !only.split(',').includes(name)) return;
    const c = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
    const p = await c.newPage();
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ' ' + m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push(name + ' pageerror: ' + e.message));
    await p.goto('http://127.0.0.1:8871/' + q); await p.waitForTimeout(400);
    for (const s of steps) { if (typeof s === 'number') await p.waitForTimeout(s); else if (s.key) await p.keyboard.press(s.key); else if (s.shot) await (s.page ? p : p.locator('#c')).screenshot({ path: pre + s.shot + '.png' }); else await p.evaluate(s); }
    await c.close();
  };
  await run('title', '', [800, { shot: 'title', page: 1 }]);
  await run('dark', '?room=library&x=118&y=150&noflicker&nothreat&seed=2', [() => { __hm.face('up'); __hm.aim(Math.atan2(88 - 143, 72 - 118)); }, 900, () => { __hm.G.msg = null; }, { shot: 'dark' }]);
  await run('scare', '?room=gallery&x=60&y=170&noflicker&seed=4', [() => { __hm.face('right'); __hm.aim(-0.35); __hm.G.threatFirst = true; }, 600, () => { __hm.spawnThreat(150, 128); }, 150, () => { __hm.G.msg = null; }, { shot: 'scare' }]);
  await run('statue', '?room=grand&x=128&y=150&noflicker&nothreat&seed=7', [() => { const o = __hm.G.room.objs.find(o => o.t === 'statue'); o.x = 6; o.y = 8; o.v = 'reach'; __hm.face('left'); __hm.aim(Math.atan2(132-143, 104-128)); }, 700, { shot: 'statue' }]);
  await run('drag', '?room=dining&x=200&y=110&noflicker&nothreat&seed=9', [() => { __hm.face('left'); __hm.aim(2.5); }, 300, () => __hm.drag(), 1500, { shot: 'drag' }]);
  await run('lights', '?debug=breaker&nothreat&seed=3', [500, () => __hm.use(), 3600, { shot: 'map' }, 3500, { shot: 'lights' }, 4600, 600, { shot: 'final' }, 3800, { shot: 'endscr' }]);
  await run('map', '?bot&speed=8&seed=5&nothreat', [9000, () => __hm.map(true), 200, { shot: 'mapov' }]);
  await run('hide', '?room=parlor&x=200&y=150&noflicker&seed=4', [() => __hm.hide(), 400, { shot: 'hide' }]);
  await run('nursery', '?room=nursery&x=128&y=180&noflicker&nothreat&seed=4', [() => { __hm.face('up'); }, 900, { shot: 'nursery' }]);
  await run('basement', '?room=wine&x=128&y=150&noflicker&nothreat&seed=4', [() => { __hm.face('up'); __hm.aim(-1.2) }, 900, { shot: 'wine' }]);
  await run('caught', '?room=library&x=40&y=180&noflicker&seed=8', [() => { __hm.G.threatFirst = true; __hm.spawnThreat(48, 182); __hm.G.lightUser = false; }, 450, { shot: 'caught' }]);
  await run('mobile', '', [600, { shot: 'mobile', page: 1 }]);
  console.log('ERRS', errs.length, errs.join('\n'));
  await b.close();
})();
