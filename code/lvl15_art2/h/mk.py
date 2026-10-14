import json
SH='/workspace/work/lvl15_art2/shots/'
B="const S=__SS.STATE,b=S.enemies.find(e=>e.boss),p=S.player;"
def js(x): return {"js":"(()=>{"+(x if x.startswith("const S") else B+x)+"})()"}
def shot(n,until=None,wait=None):
    s={"shot":SH+n}
    if until: s["until"]=until
    if wait: s["wait"]=wait
    return s
start=[{"until":"__SS.STATE.scene==='stage'"}]
# ---- Plan E: elevator elites
E=start+[js("S.fadeOut=1;"),{"until":"__SS.STATE.sec===1"},js("S.fadeOut=1;"),{"until":"__SS.STATE.sec===2&&__SS.STATE.fadeIn===0"},js("p.x=700;"),{"until":"__SS.STATE.enemies.filter(e=>e.elite&&e.state==='walk').length>=3"}]
POS="const L=S.enemies.filter(e=>e.elite).slice(0,4);p.hp=16;p.inv=200;p.x=S.camX+60;p.y=205;p.facing=1;S.enemies.forEach(e=>{e.flash=0});"
def place(states):
    out=POS
    for i,st in enumerate(states):
        out+=f"if(L[{i}]){{const e=L[{i}];e.x=S.camX+{110+i*68};e.y={200+(i%2)*10};e.flash=0;e.z=0;e.facing=-1;e.cool=9999;{st}}}"
    return out
E+=[js(place(["e.state='walk';e.walkT=0;e.t=0;e.taunt=0;","e.state='walk';e.walkT=9;e.taunt=0;","e.state='attack';e.t=2;","e.state='hurt';e.t=0;"])),shot('el_a.png',wait=60)]
E+=[js(place(["e.state='attack';e.t=2;e.type='star';","e.state='grab';e.t=0;","e.state='attack';e.t=2;e.type='dasher';","e.state='down';e.t=20;"])),shot('el_b.png',wait=60)]
E+=[js(place(["e.state='walk';e.walkT=0;e.z=18;e.vz=1;","e.state='walk';e.walkT=20;","e.flash=5;e.state='walk';e.walkT=0;","e.state='walk';e.walkT=0;"])),shot('el_c.png',wait=40)]
# ---- Plan S: Shredder (section 2)
SP=start+[js("S.fadeOut=1;"),
  {"until":"__SS.STATE.enemies.some(e=>e.boss&&e.state==='walk')"}]
BP=B+"p.hp=16;p.inv=200;p.x=150;p.y=190;p.facing=1;b.x=230;b.y=188;b.facing=-1;b.cool=9999;"
SP+=[js(BP+"b.state='walk';b.walkT=0;b.t=0;"),shot('sh_idle.png',wait=150)]
SP+=[js(BP+"b.state='down';b.t=0;b.z=0;"),shot('sh_fall.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return b.state!=='down'||b.t>=3})()")]
SP+=[shot('sh_down.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return b.state!=='down'||b.t>=26})()")]
SP+=[js(BP+"b.state='walk';b.t=0;b.inv=0;SS.api.hitEnemy(b,999,true,1,4,true);")]+[dict(shot(f'sh_ko_{i}.png'),wait=150) for i in range(12)]
# ---- Plan U: Super Shredder
U=start+[js("S.fadeOut=1;"),{"until":"__SS.STATE.sec===1"},js("S.fadeOut=1;"),
  {"until":"__SS.STATE.sec===2&&__SS.STATE.fadeIn===0"},js("S.enemies.length=0;S.queue=[];S.wave=3;S.locked=false;S.player.x=1800;"),
  {"until":"__SS.STATE.enemies.some(e=>e.boss&&e.state==='walk')"}]
UP=B+"p.hp=16;p.inv=200;p.x=S.camX+130;p.y=200;p.facing=1;b.x=S.camX+240;b.y=198;b.facing=-1;b.cool=9999;"
U+=[js(UP+"b.state='walk';b.walkT=0;b.t=0;"),shot('su_idle.png',wait=150)]
U+=[js(UP+"b.state='down';b.t=0;b.z=0;"),shot('su_fall.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return b.state!=='down'||b.t>=3})()")]
U+=[shot('su_down.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return b.state!=='down'||b.t>=26})()")]
U+=[js(UP+"b.state='walk';b.t=0;b.inv=0;SS.api.hitEnemy(b,999,true,1,4,true);"),
    shot('su_ko1.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return !b||b.state==='dying'&&b.t>=5})()"),
    shot('su_ko2.png',until="(()=>{const b=__SS.STATE.enemies.find(e=>e.boss);return !b||b.state==='dying'&&b.t>=40})()"),
    shot('su_outro.png',until="__SS.STATE.outro&&__SS.STATE.outro.t>120")]
# ---- Plan K: L14 outro cameo
K=[{"until":"__SS.STATE.scene==='stage'","js":"(()=>{const S=__SS.STATE;S.enemies.length=0;S.queue=[];S.fadeOut=1;})()"},
   {"until":"__SS.STATE.enemies.some(e=>e.boss)&&__SS.STATE.enemies.find(e=>e.boss).state==='walk'"},
   js(B+"b.state='walk';b.t=0;b.vuln=50;SS.api.hitEnemy(b,999,true,1,4,true);"),
   {"until":"__SS.STATE.outro&&__SS.STATE.outro.t>40"},
   js("const o=__SS.STATE.outro;o.st.bx=192;o.st.by=160;o.st.ph='ramp';o.st.bz=20;"),
   shot('k14_shred_idle.png',until="__SS.STATE.outro&&__SS.STATE.outro.st.shred&&__SS.STATE.outro.t-__SS.STATE.outro.st.shred>12"),
   shot('k14_shred_taunt.png',until="__SS.STATE.outro&&__SS.STATE.outro.st.shred&&__SS.STATE.outro.t-__SS.STATE.outro.st.shred>60"),
   shot('k14_shred_end.png',until="__SS.STATE.outro&&__SS.STATE.outro.st.shred&&__SS.STATE.outro.t-__SS.STATE.outro.st.shred>160")]
for n,p in [('planE',E),('planS',SP),('planU',U),('planK',K)]: json.dump(p,open(n+'.json','w'))
