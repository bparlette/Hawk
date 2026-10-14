const pw = require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async () => {
  const b = await pw.chromium.launch({ args: ['--no-sandbox'] });
  for (const [key, out] of [['OPUS', 'Toad_City_Brief_OPUS.pdf'], ['SONNET', 'Toad_City_Brief_SONNET.pdf'], ['GEMINI_PRO', 'Toad_City_Brief_GEMINI_PRO.pdf']]) {
    const p = await b.newPage(); await p.goto('file:///workspace/work/toad-city/handoff/build/' + key + '.html', { waitUntil: 'load' });
    await p.pdf({ path: '/workspace/work/toad-city/handoff/' + out, format: 'Letter', printBackground: true, displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font:7.5px DejaVu Sans,sans-serif;color:#777;width:100%;padding:0 0.62in;display:flex;justify-content:space-between"><span>Toad City Baltimore · Outside-AI brief · ${key.replace('_', ' ')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: '0.55in', bottom: '0.7in', left: '0.62in', right: '0.62in' } });
    await p.close(); console.log('pdf', out);
  }
  await b.close();
})();
