const { webkit, devices } = require('playwright');
(async()=>{ const b = await webkit.launch(); const c = await b.newContext({...devices['iPhone 13']}); const p = await c.newPage();
await p.setContent('<p>x</p>');
console.log(await p.evaluate(async()=>{ const o={u:typeof SpeechSynthesisUtterance, voices: speechSynthesis.getVoices().length};
 try { const u=new SpeechSynthesisUtterance('hello there'); let ev=[]; u.onstart=()=>ev.push('start'); u.onend=()=>ev.push('end'); u.onerror=(e)=>ev.push('err '+e.error);
 const t=performance.now(); speechSynthesis.cancel(); speechSynthesis.speak(u); o.speakMs=performance.now()-t; await new Promise(r=>setTimeout(r,3000)); o.ev=ev; o.speaking=speechSynthesis.speaking; o.pending=speechSynthesis.pending;} catch(e){o.e=e.message} return o;}));
await b.close(); })();
