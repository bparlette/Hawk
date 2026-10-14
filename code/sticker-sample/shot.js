const {chromium}=require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:960,height:540}});
await p.goto('file://'+__dirname+'/index.html');for(const t of [4.0,5.15,8.05]){await p.evaluate(t=>{window.__T=t},t);}
await p.waitForTimeout(4050);await p.screenshot({path:'f_a.png'});await p.waitForTimeout(1150);await p.screenshot({path:'f_b.png'});await b.close()})();
