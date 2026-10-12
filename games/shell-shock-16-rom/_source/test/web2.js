const pw=require("/workspace/work/freeze_test/node_modules/playwright");
(async()=>{
  const b=await pw.webkit.launch(); const logs=[];
  const c=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const p=await c.newPage(); p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,160))); p.on('pageerror',e=>logs.push('ERR '+e.message));
  await p.goto('http://127.0.0.1:8124/index.html'); await p.waitForTimeout(2500);
  await p.screenshot({path:'m0.png'});
  await p.touchscreen.tap(422,195); await p.waitForTimeout(3000); console.log(JSON.stringify(await p.evaluate(()=>window.__gx())));
  await p.screenshot({path:'m1.png'});
  const s=await p.locator('#bS').boundingBox(); await p.touchscreen.tap(s.x+s.width/2,s.y+s.height/2); await p.waitForTimeout(2500);
  await p.screenshot({path:'m2.png'});
  // hold right via keyboard + attack taps via touch
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowRight');
  const bb=await p.locator('#bB').boundingBox(); for(let i=0;i<6;i++){await p.touchscreen.tap(bb.x+39,bb.y+39); await p.waitForTimeout(250);}
  await p.screenshot({path:'m3.png'});
  console.log(logs.slice(0,15).join('\n')); await b.close();
})();
