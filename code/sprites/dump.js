const pw=require('/workspace/work/freeze_test/node_modules/playwright');(async()=>{const b=await pw.webkit.launch();const p=await b.newPage();
p.on('pageerror',e=>console.error('PAGEERR',e.message));
await p.goto('http://127.0.0.1:8731/index.html',{waitUntil:'load',timeout:30000});
await p.waitForFunction(()=>typeof window.__galDump==='function',null,{timeout:20000});
const r=await p.evaluate(()=>window.__galDump());
require('fs').writeFileSync('manifest.json',JSON.stringify(r,null,1));
console.log(r.length, r.reduce((a,x)=>a+x.poses.length,0), JSON.stringify(r.filter(x=>x.err).map(x=>[x.name,x.err])));
await b.close();})();
