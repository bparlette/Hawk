const pwW=require('/workspace/work/freeze_test/node_modules/playwright'), pwC=require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async()=>{for(const [n,bt] of [['webkit',pwW.webkit],['chromium',pwC.chromium]]){const b=await bt.launch();
for(const vp of [[390,844],[1280,800]]){const ph=vp[0]<500;const c=await b.newContext({viewport:{width:vp[0],height:vp[1]},isMobile:ph&&n==='chromium',hasTouch:ph});const p=await c.newPage();
await p.goto('http://127.0.0.1:8801/');await p.waitForTimeout(1500);await p.screenshot({path:`/workspace/work/hubtest/hub_${n}_${vp[0]}.png`});
console.log(n,vp,await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,font:document.fonts.check('12px PS2P'),m:(()=>{const r=document.getElementById('menu').getBoundingClientRect();return [r.width,r.height]})(),ov:[...document.querySelectorAll('#opts a b,#opts a small')].filter(e=>e.scrollWidth>e.parentElement.clientWidth).length})));await c.close();}await b.close();}})();
