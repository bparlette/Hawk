const { webkit, devices } = require('playwright');
const { execFileSync } = require('child_process');
const cache = {};
async function liveRoute(route){ const u = route.request().url();
  try { if(!cache[u]) { const body = execFileSync('curl',['-s','-L',u],{maxBuffer:1e8,stdio:['ignore','pipe','ignore'],env:{...process.env,LD_LIBRARY_PATH:''}}); cache[u]=body; }
    const ct = u.endsWith('.png')?'image/png':u.endsWith('.jpg')?'image/jpeg':u.endsWith('.js')?'application/javascript':u.endsWith('.webmanifest')?'application/json':'text/html';
    await route.fulfill({status: cache[u].length?200:404, body: cache[u], contentType: ct}); } catch(e){ await route.fulfill({status:404, body:''}); } }
module.exports = { liveRoute };
if (require.main === module) (async()=>{ const b = await webkit.launch(); const c = await b.newContext({...devices['iPhone 13']}); await c.route(/surge\.sh/, liveRoute); const p = await c.newPage();
p.on('console',m=>console.log('C',m.text())); p.on('pageerror',e=>console.log('PE',e.message));
const r = await p.goto('https://sf-worldbrawl.surge.sh/'); console.log(r.status()); await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>[innerWidth,innerHeight,'ontouchstart' in window, typeof SS]));
await p.screenshot({path:'t0.png'}); await b.close(); })().catch(e=>{console.log('FAIL',e.message.slice(0,1500));process.exit(1)});
