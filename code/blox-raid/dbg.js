const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('file:///workspace/work/blox-raid/index.html'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const B = __blox, out = [];
    B.startManual(); B.advance(0.6);
    const S = (n) => out.push(n + ' en=' + Math.round(B.pl.en) + ' lock=' + B.pl.lock.toFixed(2) + ' hurt=' + B.pl.hurt.toFixed(2) + ' hits=' + B.G.hits + ' bhp=' + B.bs.hp + ' d=' + B.pl.pos.distanceTo(B.bs.pos).toFixed(1) + ' atk=' + (B.bs.atk && B.bs.atk.kind) + ' stun=' + B.bs.stun.toFixed(2));
    for (const k of ['KeyZ', 'KeyX', 'KeyV', 'KeyC']) { S('pre ' + k); out.push(k + ' fired=' + B.triggerSkill(k)); B.advance(SKILLS_LOCK = 1.5); S('post ' + k); }
    return out.join('\n');
  });
  console.log(r);
  await b.close();
})();
