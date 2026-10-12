const fs=require('fs');const vm=require('vm');
function mk(){const f=function(){return mk()};return new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>0;if(k==='length')return 0;if(k==='then')return undefined;return mk()},apply:()=>mk(),construct:()=>mk()})}
const out={};
for(let n=2;n<=15;n++){
  const src=fs.readFileSync(`/workspace/work/deploy/shell-shock-live-action/levels/level${n}.js`,'utf8');
  let cfg=null;
  const api=new Proxy({},{get:(t,k)=>{ if(k==='TRACKS')return {boss:mk()}; return mk()}});
  const SS={api, registerLevel:c=>{cfg=c}};
  const ctx={window:{SS},Math,JSON,Object,Array,Set,Map,console,Image:function(){},document:mk(),performance:{now:()=>0}};
  ctx.window.SS=SS;
  try{vm.runInNewContext(src,ctx)}catch(e){console.error(n,e.message)}
  if(!cfg){console.error('no cfg',n);continue}
  const keep=JSON.parse(JSON.stringify(cfg,(k,v)=>typeof v==='function'?undefined:v));
  out[n]=keep;
}
fs.writeFileSync('levels.json',JSON.stringify(out,null,1));
for(const n in out){const c=out[n];console.log(n,c.name,'boss',c.boss&&c.boss.name,c.boss&&c.boss.hp,c.boss&&c.boss.base,'skins',Object.keys(c.enemySkins||{}).join(','),'sec',(c.sections||[]).map(s=>s.bg).join(','),'arena',c.restructure&&c.restructure.arena&&c.restructure.arena.bg)}
