const pw=require("/workspace/work/freeze_test/node_modules/playwright");
(async()=>{
  const b=await pw.webkit.launch(); const fs=require('fs');
  const p=await (await b.newContext({viewport:{width:900,height:520}})).newPage();
  const snap=async n=>{const d=await p.evaluate(()=>document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(n,Buffer.from(d.split(',')[1],'base64'));};
  await p.goto('http://127.0.0.1:8130/index.html'); await p.waitForTimeout(5000);
  for(let i=0;i<3;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(1500); }
  await snap('p0.png'); await p.waitForTimeout(8000); await snap('p1.png');
  for(let i=0;i<4;i++){ await p.keyboard.press('Enter'); await p.waitForTimeout(400);} 
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(2500); await p.keyboard.up('ArrowRight'); await snap('p2.png');
  for(let i=0;i<10;i++){ await p.keyboard.press('j'); await p.waitForTimeout(200);} await snap('p3.png');
  await b.close();
})();
