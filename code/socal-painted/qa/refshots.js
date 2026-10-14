const { chromium } = require('/workspace/work/trailer_v2/node_modules/playwright');
const PX=(()=>{const v=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;if(!v)return undefined;const u=new URL(v);return {server:u.protocol+'//'+u.host,username:decodeURIComponent(u.username)||undefined,password:decodeURIComponent(u.password)||undefined,bypass:process.env.NO_PROXY||process.env.no_proxy};})();
(async()=>{
 const b=await chromium.launch({proxy:PX,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 for (const [name,u] of [['cel','https://shellshock-cel-city.surge.sh'],['toad','https://toad-city-baltimore.surge.sh']]) for (const [w,h] of [[390,844],[1280,720]]) {
   const p=await b.newPage({viewport:{width:w,height:h},hasTouch:w<600,isMobile:w<600});
   try{ await p.goto(u,{waitUntil:'domcontentloaded',timeout:90000}); await p.waitForTimeout(9000);
   await p.screenshot({path:`qa/ref/${name}_${w}_a.png`});
   await p.keyboard.press('Enter'); await p.mouse.click(w/2,h/2); await p.waitForTimeout(5000);
   await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
   await p.screenshot({path:`qa/ref/${name}_${w}_b.png`}); }catch(e){console.log(name,w,e.message)}
   await p.close();
 }
 await b.close();
})();
