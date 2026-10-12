const pw=require("/workspace/work/freeze_test/node_modules/playwright");
(async()=>{
  const b=await pw.webkit.launch();
  for(const [port,tag] of [[8131,'o'],[8130,'n']]){
    const p=await (await b.newContext({viewport:{width:900,height:520}})).newPage(); const logs=[];
    p.on('console',m=>logs.push(m.text().slice(0,120))); p.on('pageerror',e=>logs.push('ERR '+e.message));
    await p.goto(`http://127.0.0.1:${port}/index.html?level=1`); await p.waitForTimeout(6000);
    await p.keyboard.press('Enter'); 
    for(const t of [2,6,12]){ await p.waitForTimeout(t===2?2000:t===6?4000:6000);
      const d=await p.evaluate(()=>document.getElementById('game').toDataURL('image/png')); require('fs').writeFileSync(`${tag}_${t}.png`,Buffer.from(d.split(',')[1],'base64')); }
    console.log(tag, logs.slice(-6).join(' | '));
  }
  await b.close();
})();
