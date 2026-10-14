// node qa/trace.js <ev> <secs> <fields,comma>
const cg=require('./sim.js');const ev=+process.argv[2],secs=+process.argv[3];const fields=(process.argv[4]||'').split(',');
cg.QA.bot=true;cg.Game.handOver();cg.startComp('practice',[ev]);
for(let n=0;n<secs*60;n++){cg.Game.step(1/60);if(n%6==0){const E=cg.E();console.log((n/60).toFixed(1),cg.Game.state,fields.map(f=>f+'='+(typeof E[f]==='number'?E[f].toFixed(2):E[f])).join(' '),'in:',Object.keys(cg.In.held).filter(k=>cg.In.held[k]).join(''));}if(cg.R.ended)break;}
console.log(cg.QLOG.join(' | '));
