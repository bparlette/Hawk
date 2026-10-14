import json,sys
tag=sys.argv[1]  # before|after
O=f'shots/{tag}_'
CLR="const S=__SS.STATE,p=S.player;S.enemies.forEach(e=>{if(!e.boss){e.x=-999;e.hp=0;e.state='dying';e.t=89;}});S.queue=[];S.locked=false;p.hp=16;p.inv=999;"
CAM="if(!window.__camHook){window.__camHook=1;let v=S.camX;Object.defineProperty(S,'camX',{configurable:true,get(){return window.__cam!=null?window.__cam:v},set(q){v=q}});setInterval(()=>{if(window.__noEn)__SS.STATE.enemies.forEach(e=>{if(!e.boss){e.x=-999;e.hp=0;e.state='dying';e.t=89;}});},50);}"
def mv(x,y): return f"(()=>{{{CLR}{CAM}window.__noEn=1;window.__cam={x}-150;p.x={x};p.y={y};p.facing=1;}})()"
REL="(()=>{window.__cam=null;window.__noEn=0;})()"
FF="(()=>{const S=__SS.STATE,p=S.player;p.hp=16;p.inv=999;if(S.sec===0){S.enemies.forEach(e=>{e.hp=0;e.state='dying';e.t=89;});S.queue=[];p.x=Math.min(p.x+30,S.camX+370);p.y=190;}})()"
BOSSW="(()=>{const S=__SS.STATE;return S.sec===1&&!!S.enemies.find(e=>e.boss&&(e.state==='walk'))})()"
plans={}
# ---- L2 ----
L2=[{"js":mv(300,200),"wait":1500},
 {"js":"(()=>{const H=__SS.STATE.haz[1].st.list[0];H.t=100;})()","wait":60,"shot":O+"l2_hydrant_idle.png"},
 {"js":"(()=>{const H=__SS.STATE.haz[1].st.list[0];H.t=230;})()","wait":60,"shot":O+"l2_hydrant_warn.png"},
 {"js":"(()=>{const S=__SS.STATE,H=S.haz[1].st.list[0];H.t=278;S.player.y=214;S.player.x=280})()","wait":120,"shot":O+"l2_hydrant_spray.png"},
 {"js":mv(600,214),"wait":1500,"shot":O+"l2_manhole.png"},
 {"js":mv(1110,214),"wait":1500,"shot":O+"l2_manhole2.png"}]
plans['2']=L2
# ---- L6 ----
L6=[{"js":mv(230,200),"wait":1500},
 {"js":"(()=>{const S=__SS.STATE,I=S.haz[2].st,B=S.haz[1].st;I.cd=1e9;B.cd=1e9;S.haz[3].st.cd=1e9;I.list.push({x:S.camX+200,y:180,t:30},{x:S.camX+300,y:205,t:62});B.list.push({x0:S.camX+40,y0:150,tx:S.camX+200,ty:190,t:22,T:54,big:false},{x0:S.camX+360,y0:150,tx:S.camX+260,ty:200,t:26,T:62,big:true});})()","wait":40},{"js":"__SS.STATE.haz[1].st.list.map(b=>[b.t,b.T,b.x0|0,b.tx|0,b.big])","shot":O+"l6_icicles_snowballs.png"},
 {"js":"(()=>{const S=__SS.STATE,st=S.haz[3].st;S.player.x=S.camX+60;S.player.y=208;st.ph='go';st.t=10;st.x=S.camX+200;st.dir=1;st.hit=new Set();st.y=184;S.haz[3].h._u=S.haz[3].h.update;S.haz[3].h.update=null;})()","wait":120,"shot":O+"l6_plow_r.png"},
 {"js":"(()=>{const S=__SS.STATE,st=S.haz[3].st;st.dir=-1;st.x=S.camX+220;})()","wait":80,"shot":O+"l6_plow_l.png"},
 {"js":"(()=>{const S=__SS.STATE;S.haz[3].h.update=S.haz[3].h._u;S.haz[3].st.ph='idle';S.haz[3].st.cd=1e9;})()","wait":50},
 {"js":mv(1110,186),"wait":1500,"shot":O+"l6_ice.png"},
 {"js":REL},{"until":BOSSW,"tick":FF,"tries":600},
 {"js":"(()=>{const S=__SS.STATE,p=S.player,e=S.enemies.find(e=>e.boss);S.enemies.filter(m=>!m.boss).forEach(m=>{m.x=-999});p.inv=0;p.x=S.camX+120;p.y=190;e.x=S.camX+250;e.y=190;e.facing=-1;e.state='spray';e.t=40;e.cool=999;})()","wait":2600},{"js":"(()=>{const p=__SS.STATE.player;return [p.hurtT,p.inv,p.hp]})()","wait":300,"shot":O+"l6_frozen.png"}]
plans['6']=L6
# ---- L8 ----
L8=[{"js":mv(470,195),"wait":1500},
 {"js":"(()=>{const S=__SS.STATE;S.haz[0].st.list[0].t=80;S.haz[1].st.list.forEach(v=>v.t=50);})()","wait":60,"shot":O+"l8_laser_off.png"},
 {"js":"(()=>{const S=__SS.STATE;S.haz[0].st.list[0].t=230;S.haz[1].st.list[0].t=225;})()","wait":60,"shot":O+"l8_laser_on.png"},
 {"js":"(()=>{const S=__SS.STATE;S.haz[0].st.list[0].t=170;S.haz[1].st.list[0].t=270;})()","wait":60,"shot":O+"l8_laser_warn_vent_blast.png"},
 {"js":mv(830,200),"wait":1500},
 {"js":"(()=>{const S=__SS.STATE,P=S.haz[3].st.list;P[0].t=20;P[1].t=260;S.haz[1].st.list[2].t=100;})()","wait":60,"shot":O+"l8_panels.png"},
 {"js":"(()=>{const S=__SS.STATE,P=S.haz[3].st.list;P[0].t=190;P[1].t=230;S.haz[1].st.list[2].t=220;})()","wait":60,"shot":O+"l8_panels2.png"},
 {"js":REL},{"until":"(()=>{const S=__SS.STATE;return S.sec===1&&!!S.enemies.find(e=>e.boss)})()","tick":FF,"tries":600},
 {"wait":1500,"shot":O+"l8_throne.png"},
 {"js":"(()=>{const S=__SS.STATE;__SS.STATE.player.x=150;})()","until":"(()=>{const e=__SS.STATE.enemies.find(e=>e.boss);return e&&e.state==='walk'})()","tick":"(()=>{__SS.STATE.player.hp=16})()","tries":300},
 {"js":"(()=>{const S=__SS.STATE,e=S.enemies.find(e=>e.boss);e.state='summon';e.t=10;e.sumCd=0;})()","wait":220,"shot":O+"l8_glass.png"},
 {"wait":150,"shot":O+"l8_glass2.png"}]
plans['8']=L8
for k,v in plans.items(): json.dump(v,open(f'plan_{tag}_{k}.json','w'),indent=0)
