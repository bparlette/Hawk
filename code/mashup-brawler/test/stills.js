// usage: node stills.js clip outprefix spec...   spec = f<lt> (fight lt), r<pt> (replay real t), w<pt> (walk real t), s<segIndex>:f<lt> for montage
const {chromium}=require('/workspace/work/trailer_v2/node_modules/playwright-core');const fs=require('fs');
(async()=>{const [clip,out,...specs]=process.argv.slice(2);const b=await chromium.launch({args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('C:',m.text())});
await p.goto('file:///workspace/work/mashup-brawler/dist/index.html?capture=1&'+(clip[0]=='L'?'level='+clip.slice(1):'clip='+clip));await p.waitForTimeout(200);
const want=specs.map(s=>{let si=null;if(s.includes(':')){si=+s.split(':')[0].slice(1);s=s.split(':')[1]}return{ph:{f:'fight',r:'replay',w:'walk'}[s[0]],v:+s.slice(1),si,done:false,s}});
let fr=0;const info=[];while(fr<3000){const st=await p.evaluate(()=>{const d=MB.frame(2);const G=MB.G;return{d,ph:G.ph,lt:G.lt,pt:G.pt,si:G.si}});fr++;
 for(const w of want){if(w.done)continue;if(w.si!=null&&w.si!==st.si)continue;const val=w.ph==='fight'?st.lt:st.pt;if(st.ph===w.ph&&val>=w.v){w.done=true;const d=await p.evaluate(()=>document.getElementById('c').toDataURL('image/jpeg',.85));fs.writeFileSync(out+'_'+w.s.replace(/[:.]/g,'_')+'.jpg',Buffer.from(d.split(',')[1],'base64'));info.push(w.s+' frame '+fr)}}
 if(st.d||want.every(w=>w.done)||(st.si>0&&clip[0]=='L'))break}
const qa=await p.evaluate(()=>MB.qa());console.log('frames',fr,'sec',(fr/30).toFixed(2));console.log(info.join('\n'));console.log(qa.filter(q=>q[3]!=='OK').map(q=>q.join(' ')).join('\n')||'QA all OK ('+qa.length+')');await b.close()})();
