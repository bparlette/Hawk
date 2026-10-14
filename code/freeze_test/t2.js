const pw = require('playwright'); const { liveRoute } = require('./t0.js');
(async()=>{ const b = await pw.webkit.launch(); const c = await b.newContext({...pw.devices['iPhone 13']}); await c.route(/surge\.sh/, liveRoute); const p = await c.newPage();
p.on('console',m=>console.log('C',m.text()));
await p.goto('https://sf-worldbrawl.surge.sh/?debug&nomap'); await p.waitForTimeout(2000);
console.log(await p.evaluate(async()=>{ const S=__SS.STATE; let n=0; const s=speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak=(u)=>{n++; return s(u)};
  S.player = S.player || null; return {muted:S.muted, ls: JSON.stringify(localStorage)}; }));
await b.close(); })();
