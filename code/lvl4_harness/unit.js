const fs=require('fs'); let def; const log=[];
const ctx=new Proxy({},{get(t,k){ if(k in t) return t[k]; return (...a)=>log.push(k+' '+a.join(','));},set(t,k,v){t[k]=v;log.push('set '+k+'='+v);return true;}});
const api={W:384,H:224,t:5,ctx,rect:(...a)=>log.push('rect '+a.join(',')),ptext:(...a)=>log.push('ptext '+a.join(',')),player:{y:188,x:60},TRACKS:{boss:{}},track:()=>({}),transpose:()=>({}),bassLine:()=>[],arpLine:()=>[],rep:(s,n)=>Array(n).fill(s),lerp:(a,b,k)=>a+(b-a)*k};
global.window={SS:{api,registerLevel:d=>{def=d;}}};
eval(fs.readFileSync('/workspace/work/lvl4_test/levels/level4.js','utf8'));
const tr=def.sections[0].hazards[0]; const st={list:[{kind:'car',lane:208,x:384,t:3,warn:62,col:'#fff',hit:new Set()}]};
tr.drawBack(st,api,0); console.log(log.join('\n'));
