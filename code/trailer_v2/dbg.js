const { chromium, devices } = require("playwright");
(async () => { const b = await chromium.launch(); const c = await b.newContext({ ...devices["iPhone 13"] }); const p = await c.newPage();
 await p.goto("http://127.0.0.1:8777/index.html"); await p.waitForTimeout(2000);
 console.log(await p.evaluate(async () => { const v=document.getElementById("hv"); const o=[]; v.pause();
   for (const f of [70,182,400]) { v.currentTime=(f+0.5)/30; await new Promise(r=>v.addEventListener("seeked",r,{once:true})); o.push(["seeked",f,v.currentTime.toFixed(3),document.getElementById("cab").getAttribute("data-inp")]); await new Promise(r=>setTimeout(r,300)); o.push(["later",v.currentTime.toFixed(3),document.getElementById("cab").getAttribute("data-inp")]); }
   return JSON.stringify(o); }));
 await b.close(); })();
