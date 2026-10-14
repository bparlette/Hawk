const fs=require('fs');const core=fs.readFileSync('core.js','utf8');
const grab=(n)=>{const i=core.indexOf('  function '+n+'(');let j=core.indexOf('\n  }\n',i);return core.slice(i,j+4);};
eval(grab('galLit')+grab('galBrace')+'const GAL_LATE=/^(hurt|fall|lie|down|ko|getup)/i;'+grab('galPoses')+';global.galLit=galLit;global.galPoses=galPoses;');
for (const [n,f] of [[2,'sodom'],[3,'birdie']]) { const t=fs.readFileSync('../sf_brawler/game/levels/level'+n+'.js','utf8'); const o=galLit(t,null,'levels/level'+n+'_'+f+'.png'); console.log(n, o && galPoses(o).map(p=>p.n).join(' ')); }
