const pwW=require('/workspace/work/freeze_test/node_modules/playwright'), pwC=require('/workspace/work/trailer_v2/node_modules/playwright-core');
const B='http://127.0.0.1:8801/', DEST=['shell-shock-live/','shell-shock-16bit/','shell-shock-live-home/','shell-shock-16bit-home/'];
const PAD=`(()=>{const pad={id:'fake',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0})),timestamp:0};
 window.__pad=pad;navigator.getGamepads=()=>[pad];window.__padSet=(i,v)=>{pad.buttons[i]={pressed:v,value:v?1:0}};})();`;
let fails=0; const res=[];
(async()=>{for(const [n,bt] of [['webkit',pwW.webkit],['chromium',pwC.chromium]]){const b=await bt.launch();
 for(const vp of [[390,844],[1280,800]]){const ph=vp[0]<500;
  const c=await b.newContext({viewport:{width:vp[0],height:vp[1]},hasTouch:ph,isMobile:ph&&n==='chromium'});await c.addInitScript(PAD); await c.route(u=>DEST.some(d=>u.href===B+d),r=>r.fulfill({contentType:'text/html',body:'<title>dest</title>ok'}));
  const errs=[]; const p=await c.newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  async function fresh(){await p.goto(B);await p.waitForTimeout(400);}
  async function landed(i,how){try{await p.waitForURL(B+DEST[i],{timeout:5000});res.push(`${n} ${vp[0]} ${how} -> ${DEST[i]} OK`);}catch(e){fails++;res.push(`${n} ${vp[0]} ${how} -> ${DEST[i]} FAIL (at ${p.url()})`);}}
  for(let i=0;i<4;i++){ // keyboard (alternate arrows/WASD, Enter/Space)
   await fresh(); for(let k=0;k<i;k++) await p.keyboard.press(i%2?'s':'ArrowDown'); 
   const sel=await p.evaluate(()=>window.__hub.cur); if(sel!==i){fails++;res.push(`kbd sel ${sel}!=${i}`);}
   await p.keyboard.press(i%2?' ':'Enter'); await landed(i,'keyboard');}
  for(let i=0;i<4;i++){ // wrap-around up
   if(i!==3) continue; await fresh(); await p.keyboard.press('ArrowUp'); await p.keyboard.press('Enter'); await landed(3,'keyboard-wrap-up');}
  for(let i=0;i<4;i++){ // tap / click option directly
   await fresh(); const a=p.locator('#opts a').nth(i); if(ph) await a.tap(); else await a.click(); await landed(i,ph?'tap':'click');}
  for(let i=0;i<4;i++){ // gamepad: d-pad down i times (+stick axis for one), A / Start
   await fresh(); await p.evaluate(()=>window.dispatchEvent(new Event('gamepadconnected')));
   for(let k=0;k<i;k++){ if(k===1){await p.evaluate(()=>{__pad.axes[1]=0.9});await p.waitForTimeout(120);await p.evaluate(()=>{__pad.axes[1]=0});}
     else {await p.evaluate(()=>__padSet(13,true));await p.waitForTimeout(120);await p.evaluate(()=>__padSet(13,false));} await p.waitForTimeout(100);}
   const sel=await p.evaluate(()=>window.__hub.cur); if(sel!==i){fails++;res.push(`pad sel ${sel}!=${i}`);}
   const btn=i===2?9:0; await p.evaluate(b=>__padSet(b,true),btn); await landed(i,'gamepad'+(btn===9?'-start':'-A'));}
  for(let i=0;i<4;i++){ // cabinet joystick + buttons
   await fresh(); for(let k=0;k<i;k++){ const h=p.locator('#hit-dn'); if(ph) await h.tap(); else await h.click(); await p.waitForTimeout(120); /* hub ignores repeats <60ms apart */ }
   if(i===3){ const u=p.locator('#hit-up'); ph?await u.tap():await u.click(); await p.waitForTimeout(120); const d=p.locator('#hit-dn'); ph?await d.tap():await d.click(); await p.waitForTimeout(120); }
   const st=await p.evaluate(()=>document.getElementById('stick').style.transform);
   const k=['a','b','p','a'][i]; const h=p.locator('#hit-'+k); ph?await h.tap():await h.click(); await landed(i,'cabinet-stick+'+k+(st?' (stick animated)':''));}
  // no navigation without a selection
  await fresh(); await p.waitForTimeout(1500); if(p.url()!==B){fails++;res.push('auto-navigated!');}
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth); if(ov){fails++;res.push(`${n} ${vp[0]} overflow`);}
  res.push(`${n} ${vp[0]} console/page errors: ${JSON.stringify(errs)}`); if(errs.length) fails++;
  await c.close();}
 await b.close();}
 console.log(res.join('\n')); console.log('FAILS',fails);})();
