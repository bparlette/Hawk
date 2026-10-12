// Audio path test (no mute): start game with a key press so WebAudio initialises, run stage scenes briefly
const { chromium } = require('/workspace/work/freeze_test/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/workspace/work/freeze_test/pw-browsers/chromium-1134/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  for (const st of [0, 1, 2, 4, 5]) {
    await p.goto('file:///workspace/work/tip/site/index.html' + (st ? '?stage=' + st + '&bot&god' : ''));
    await p.waitForTimeout(800);
    await p.keyboard.press('Enter'); await p.keyboard.press('KeyJ');
    await p.waitForTimeout(3500);
    console.log(st, await p.evaluate(() => [GT.sceneName, GT.AU.ac && GT.AU.ac.state, GT.AU.songName]));
  }
  console.log('ERRORS', errs.length, errs.join('\n'));
  await b.close();
})();
