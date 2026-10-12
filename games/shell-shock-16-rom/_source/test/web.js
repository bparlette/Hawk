const pw=require("/workspace/work/freeze_test/node_modules/playwright");
(async()=>{
  const b=await pw.webkit.launch(); const p=await b.newPage({viewport:{width:900,height:800}}); const logs=[]; await p.addInitScript(()=>{window.MediaRecorder=class{static isTypeSupported(){return false}};}); p.on('requestfailed',r=>logs.push('FAILREQ '+r.url()));
  p.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,200))); p.on('pageerror',e=>logs.push('ERR '+e.message));
  await p.goto(process.argv[2]||'http://127.0.0.1:8123/local.html',{waitUntil:'load'});
  await p.waitForTimeout(15000); await p.screenshot({path:'web1.png'});
  await p.mouse.click(450,330); await p.waitForTimeout(6000); await p.screenshot({path:'web2.png'});
  await p.keyboard.down('Enter'); await p.waitForTimeout(200); await p.keyboard.up('Enter'); await p.waitForTimeout(5000);
  await p.screenshot({path:'web3.png'});
  console.log(logs.filter(l=>!/Translation/.test(l)).slice(0,30).join('\n')); await b.close();
})();
