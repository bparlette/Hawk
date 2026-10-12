const pw=require("/workspace/work/freeze_test/node_modules/playwright");
(async()=>{
  const b=await pw.webkit.launch(); const errs=[];
  const p=await (await b.newContext({viewport:{width:900,height:520}})).newPage();
  p.on('pageerror',e=>errs.push(e.message));
  const go=async(q,name,wait,keys)=>{ await p.goto('http://127.0.0.1:8131/index.html'+q); await p.waitForTimeout(wait);
    if(keys) for(const k of keys){ if(k[0]==='WAIT'){await p.waitForTimeout(k[1]);continue;} await p.keyboard.down(k[0]); await p.waitForTimeout(k[1]); await p.keyboard.up(k[0]); await p.waitForTimeout(150);} 
    const d=await p.evaluate(()=>document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(name,Buffer.from(d.split(',')[1],'base64')); };
  await go('','o0.png',5000);
  for(const n of [1]) await go('?level='+n,'o'+n+'.png',7000,[['Enter',100],['Enter',100],['WAIT',5000],['ArrowRight',1500],['j',100],['j',100],['k',100]]);
  console.log('errors:',errs.slice(0,5).join(' | ')); await b.close();
})();
