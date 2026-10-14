const fs=require('fs');const core=fs.readFileSync('core.js','utf8');
const grab=(n)=>{const i=core.indexOf('  function '+n+'(');let j=core.indexOf('\n  }\n',i);return core.slice(i,j+4);};
eval(grab('galLit')+grab('galBrace')+'const GAL_LATE = /^(hurt|stun|daze|stagger|fall|lie|down|dying|dead|ko|getup|get_up|knock|dizzy)/i;'+grab('galPoses')+';global.galLit=galLit;global.galPoses=galPoses;');
const dir=process.argv[2];
const ents=[[2,'brickjaw','BJF'],[3,'gator','GTF'],[4,'jetwash','JWF'],[5,'grimwale','GWF'],[6,'coldfront','CFF'],[7,'rustmaul','RMF'],[8,'razorback','RZF'],[9,'karai','KF'],[10,'armaggon','F'],[11,'gator','GF'],[12,'viral','VF'],[13,'traag','FR','traag'],[13,'granitor','FR','granitor'],[14,'krang','KRF'],[15,'shredder','SHF'],[15,'super','SUF'],[15,'elite','ELF']];
for(const [n,f,fr,sub] of ents){const txt=fs.readFileSync(dir+'/levels/level'+n+'.js','utf8');
 for (const nm of [fr,null]) { let o=galLit(txt,nm,'levels/level'+n+'_'+f+'.png'); if(o&&sub)o=o[sub]; const p=o?galPoses(o):[]; console.log(n,f,nm||'(auto)',p.length, p.map(x=>x.n).join(' ').slice(0,160)); }}
