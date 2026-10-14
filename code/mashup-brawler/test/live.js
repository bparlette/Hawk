const {chromium}=require('/workspace/work/trailer_v2/node_modules/playwright-core');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('https://mashup-brawler.surge.sh/?level=3');await p.waitForTimeout(4000);await p.screenshot({path:'test/st/live_phone.png'});console.log('errors',errs);await b.close()})();
