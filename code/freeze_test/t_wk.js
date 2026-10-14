const pw=require('playwright');(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({...pw.devices['iPhone 13']});const p=await c.newPage();
for (const u of process.argv.slice(2)) { try { const r=await p.goto(u,{waitUntil:'load',timeout:20000}); console.log(u, r&&r.status()); } catch(e){ console.log(u,'ERR',e.message.slice(0,150)); } }
await b.close();})();
