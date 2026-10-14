const pwC=require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async()=>{const b=await pwC.chromium.launch();for(const U of ['http://127.0.0.1:8804/','http://127.0.0.1:8801/']){const r=[];for(let t=0;t<4;t++){
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const p=await c.newPage();await p.goto(U);await p.waitForTimeout(400);
for(let k=0;k<2;k++) await p.locator('#hit-dn').tap(); r.push(await p.evaluate(()=>__hub.cur)); await c.close();}console.log(U,r.join(','));}await b.close();})();
