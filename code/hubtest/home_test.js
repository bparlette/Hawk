const pwW=require('/workspace/work/freeze_test/node_modules/playwright'), pwC=require('/workspace/work/trailer_v2/node_modules/playwright-core');
const fs=require('fs'), url=require('url');
const PAGES=[['painted-src','http://127.0.0.1:8802/'],['16bit-src','http://127.0.0.1:8803/'],['painted-repo','http://127.0.0.1:8801/shell-shock-live-home/'],['16bit-repo','http://127.0.0.1:8801/shell-shock-16bit-home/']];
const only=process.argv[2], onlyP=process.argv[3]; let fails=0; const out=[];
(async()=>{for(const [bn,bt] of [['webkit',pwW.webkit],['chromium',pwC.chromium]]){ if(only&&only!==bn) continue; const b=await bt.launch();
 for(const [pn,U] of PAGES.filter(x=>!onlyP||x[0]===onlyP)) for(const vp of [[390,844],[1280,800]]){ const ph=vp[0]<500;
  const c=await b.newContext({viewport:{width:vp[0],height:vp[1]},hasTouch:ph,isMobile:ph&&bn==='chromium'});
  await c.route('https://shellshock-sprites.surge.sh/**',r=>{const f='/workspace/work/sprites/out'+url.parse(r.request().url()).pathname; fs.existsSync(f)?r.fulfill({path:f,contentType:'image/png'}):r.fulfill({status:404});});
  const p=await c.newPage(); const reqs=[], errs=[];
  p.on('request',r=>reqs.push(r.url())); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto(U,{waitUntil:'load'}); await p.waitForTimeout(3000);
  const spr=u=>/sprites\.json|shellshock-sprites|\/sprites\/(painted|16bit)\//.test(u);
  const init=reqs.filter(spr).length; const ov0=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  const labels=await p.$$eval('nav.secidx a',as=>as.map(a=>[a.getAttribute('href'),a.textContent]));
  const navPos=await p.evaluate(()=>{const pl=document.querySelector('a.play'), n=document.querySelector('nav.secidx'); return pl.nextElementSibling===n;});
  let line=`${bn} ${pn} ${vp[0]}: initial sprite reqs=${init} overflow=${ov0} navDirectlyUnderPlay=${navPos} buttons=${labels.length}`;
  if(init||ov0>0||!navPos||labels.length!==5) fails++;
  // jump order: versus first (worst case, passes the lazy cast), then the rest, then back to trailer
  const order=['#versus','#hero','#level1','#levels','#cast','#versus','#hero'];
  const jr=[];
  for(const h of order){
    if(h!=='#hero'){ await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(300); }
    const btn=p.locator(`nav.secidx a[href="${h}"]`); await btn.scrollIntoViewIfNeeded(); if(ph) await btn.tap(); else await btn.click();
    let ok=false, top=null; for(let k=0;k<40&&!ok;k++){ await p.waitForTimeout(150);
      const r=await p.evaluate(h=>{const t=document.querySelector(h); const tp=t.getBoundingClientRect().top; const atEnd=Math.abs(scrollY+innerHeight-document.documentElement.scrollHeight)<3; return {tp:Math.round(tp),y:Math.round(scrollY),atEnd};},h);
      top=r; ok= h==='#hero' ? r.y===0 : (Math.abs(r.tp-10)<=4 || (r.atEnd && r.tp>=0 && r.tp<vp[1])); }
    // make sure it stays put
    await p.waitForTimeout(800); const r2=await p.evaluate(h=>Math.round(document.querySelector(h).getBoundingClientRect().top),h);
    const stay= h==='#hero' ? await p.evaluate(()=>scrollY===0) : Math.abs(r2-10)<=6;
    jr.push(`${h}:${ok&&stay?'ok':'FAIL('+JSON.stringify(top)+' later '+r2+')'}`); if(!(ok&&stay)) fails++;
  }
  const castBuilt=await p.evaluate(()=>document.querySelectorAll('#cast .scard').length);
  // full trailer link plays inside cabinet, no native fullscreen
  await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(300);
  const fp=p.locator('#fullplay'); await fp.scrollIntoViewIfNeeded(); if(ph) await fp.tap(); else await fp.click(); await p.waitForTimeout(1500);
  const fpr=await p.evaluate(()=>{const v=document.getElementById('hv'); const r=document.getElementById('screen').getBoundingClientRect(); return {fs:!!(document.fullscreenElement||document.webkitFullscreenElement||v.webkitDisplayingFullscreen), inView:r.top>=-2&&r.bottom<=innerHeight+2, t:+v.currentTime.toFixed(2), paused:v.paused};});
  if(fpr.fs||!fpr.inView) fails++;
  const ov1=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth); if(ov1>0) fails++;
  const uerr=[...new Set(errs)]; if(uerr.length) fails++;
  out.push(line+`\n   jumps: ${jr.join(' ')}  castCards=${castBuilt}\n   fullplay: ${JSON.stringify(fpr)}  overflowAfter=${ov1}  consoleErrors=${JSON.stringify(uerr)}`);
  if(vp[0]===390&&bn==='webkit') await p.evaluate(()=>scrollTo(0,0)).then(async()=>{ const n=p.locator('nav.secidx'); await n.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:`/workspace/work/hubtest/secidx_${pn}_${bn}_${vp[0]}.png`}); });
  if(vp[0]===1280&&bn==='chromium'){ await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(200); const n=p.locator('nav.secidx'); await n.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:`/workspace/work/hubtest/secidx_${pn}_${bn}_${vp[0]}.png`}); }
  await c.close(); console.log(out[out.length-1]); }
 await b.close();}
 console.log('FAILS',fails);})();
