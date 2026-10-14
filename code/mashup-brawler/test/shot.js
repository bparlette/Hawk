const {chromium}=require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('console',m=>console.log('C:',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.argv[2]+'?capture=1');await p.waitForTimeout(300);
const d=await p.evaluate(()=>document.getElementById('c').toDataURL('image/png'));require('fs').writeFileSync(process.argv[3],Buffer.from(d.split(',')[1],'base64'));await b.close()})();
