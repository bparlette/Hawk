// ================= WORLD 3: CHEMICAL JUNGLE — Donkey Kong (+Tails' twin-tail nunchucks) vs Robotnik =================
const PNUT=[...Array(10)].map((_,i)=>6.5+i*.13);
const STACK=[[700,-63],[820,-63],[940,-63],[760,-189],[880,-189],[820,-315]];
function nunLag(o){if(o.atk){const k=o.atk.k;return k<0?lerp(2.2,1.4,seg(k,-.18,-.06))*(k<-.03?1:seg(k,0,-.03)):k<.12?lerp(0,-.5,k/.12):lerp(-.5,2.2,seg(k,.12,.3))}if(o.rush)return Math.sin(o.t*60)*.5;return 2.2+Math.sin((o.t||0)*3)*.2}
const L3=mkLevel({id:3,seed:303,wtag:'WORLD 3',name:'CHEMICAL JUNGLE',title:'WORLD 3 · CHEMICAL JUNGLE',vs:'DONKEY KONG  vs  ROBOTNIK',
 hn:'DONKEY KONG',hsub:"+ TAILS' TWIN-TAIL NUNCHUCKS",vn:'DR. ROBOTNIK',vsub:'EGG MOBILE',hero:DK,vil:EGG,tmap:{upper:'slash'},wpn:'nunch',vw:'none',
 hx:300,vx:640,lunge:34,vLunge:40,vAtk:'jab',root:87,cWord:'EGG PUNCH!',
 words:['WHIP!','THWAK!','CRACK!','FWAP!','WHAM!'],wRush:'TAIL SPIN!',wEnd:'KRAKOOM!',
 extraVHit:[6.02,6.07].concat(PNUT.map(t=>t+.16)),
 koT:10.75,replayAt:10.75,endT:12.35,mS:10.0,mE:12.1,bg:bgJungle,
 walkPose(w){return{x:0,y:GY,face:1,wpn:'nunch',walk:w+.01,t:w,A:[.5,.5,-1.2],nlag:2.0}},
 vTip(S){const v=S.v;const p=toW(EGG,v,60+70*(v.punch||0)+14,-62);const b=boxW(DK,S.h);G.qa.push([3,'eggpunch',+G.lt.toFixed(2),inBox(p,b)?'OK':'MISS']);return p},
 diddy(lt){if(lt<4.7||lt>8.2)return null;const o={x:-120,y:GY,face:1,wpn:'none',t:lt,A:restA(lt)};
  if(lt<5.05){o.x=lerp(-120,this.hx-200,seg(lt,4.7,5.05));o.walk=lt*18}else if(lt<5.5)o.x=this.hx-200;
  else if(lt<5.6){o.x=lerp(this.hx-200,this.hx-80,seg(lt,5.5,5.6));o.jump=1;o.y=GY-60}
  else if(lt<5.9){const u=eout(seg(lt,5.6,5.9));o.x=lerp(this.hx-80,this.hx+40,u);o.y=lerp(GY-130,GY-800,u);o.jump=1}
  else if(lt<6.07){const u=ein(seg(lt,5.9,6.07));o.x=lerp(this.hx+40,461,u);o.y=lerp(GY-800,GY-303,u);o.kick=1;o.lean=.5}
  else if(lt<6.45){const u=seg(lt,6.07,6.45);o.x=lerp(461,this.hx-170,u);o.y=lerp(GY-303,GY,u)-Math.sin(u*Math.PI)*200;o.rot=-u*TAU;o.jump=1}
  else if(lt<7.85){o.x=this.hx-170;o.A=[1.75,-.1,0];o.B=[1.6,0];o.pop=1;const f=PNUT.find(t=>lt>=t&&lt<t+.06);if(f)o.x-=6}
  else{const u=seg(lt,7.85,8.2);o.x=lerp(this.hx-170,-200,u);o.rot=-u*TAU*1.5;o.y=GY-Math.sin(u*Math.PI)*120}
  return o},
 hammer(lt){if(lt<10.5)return lerp(1.7,3.9,ease(seg(lt,10.1,10.5)));return lerp(3.9,1.25,ein(seg(lt,10.5,10.75)))},
 pose(lt){let S;const bob=Math.sin(lt*3)*12;
  if(lt<4.7||(lt>=6.45&&lt<STD.fin)){S=stdPose(this,lt);}
  else{const h=H0(this,lt),v=V0(this,lt);react(v,lt,this.vHit);S={h,v};
   if(lt<6.45){// Diddy spring + partner jump kick
    if(lt>=5.1&&lt<5.3){const u=seg(lt,5.1,5.3);h.x=lerp(this.hx,this.hx-200,u);h.y=GY-Math.sin(u*Math.PI)*120;h.jump=1}
    else if(lt>=5.3&&lt<5.4){h.x=this.hx-200;h.y=GY-110+seg(lt,5.3,5.4)*50;h.sy=.85}
    else if(lt>=5.4&&lt<5.8){const u=eout(seg(lt,5.4,5.8));h.x=lerp(this.hx-200,this.hx-40,u);h.y=lerp(GY-60,GY-950,u);h.jump=1;h.A=[2.6,.3,-.6]}
    else if(lt>=5.8&&lt<6.02){const u=ein(seg(lt,5.8,6.02));h.x=lerp(this.hx-40,400,u);h.y=lerp(GY-950,GY-250,u);h.kick=1;h.lean=.5}
    else if(lt>=6.02&&lt<6.45){const u=seg(lt,6.02,6.45);h.x=lerp(400,this.hx,u);h.y=lerp(GY-250,GY,u)-Math.sin(u*Math.PI)*260;h.rot=-u*TAU;h.jump=1}
    if(lt>=6.02&&lt<6.6){const u=seg(lt,6.02,6.6);v.x+=Math.sin(u*Math.PI)*90;v.rot=Math.sin(u*Math.PI*2)*.3}}
   else if(lt<STD.fin+.2){}
   else{// BARREL BARRAGE
    h.x=this.hx+ease(seg(lt,9.85,10.1))*120;
    if(lt>=10.1){const ph=this.hammer(lt);h.A=[ph,0,0];h.B=[ph-.12,0];h.wpn='none';h.lean=lt<10.5?-.1:.12;
     const s=armSolve(DK,h),hw=toW(DK,h,s.hx,s.hy),d=[Math.sin(ph),Math.cos(ph)];const c=[hw[0]+d[0]*150,hw[1]+d[1]*150];
     if(lt<10.75){v.sc=.9;v.rot=Math.PI/2-ph;v.hurt=1;v.x=c[0];v.y=c[1]+80*2.2*.9;v.shadow=false;v.cx=c}
     else{const u=seg(lt,10.75,11.4);v.sc=.9;v.x=lerp(c[0],W+300,u);v.y=lerp(c[1],-300,u)+80*2.2*.9;v.rot=u*12;v.hurt=1;v.shadow=false;if(lt>11.4)v.hide=1}}
    else{v.x=lerp(this.vx,this.vx-60,seg(lt,9.85,10.1));v.hurt=lt>10.0?1:0}
    if(lt>12.0){h.A=VICT;h.wpn='nunch';h.B=[2.8,.2];h.y=GY-Math.abs(Math.sin((lt-12)*6))*30}}}
  if(!(lt>=STD.fin&&lt>=10.1))S.v.y+=-110+bob;
  S.h.nlag=S.h.wpn==='nunch'?nunLag(S.h):0;
  for(const ct of STD.counters){const k=lt-ct;if(k>-.15&&k<.3){S.v.punch=k<0?seg(k,-.15,0):k<.12?1:1-seg(k,.12,.3)}}
  S.d=this.diddy(lt);return S},
 back(lt,S,cam){if(lt>5.0&&lt<6.6)spring(this.hx-200-cam,GY,lt>5.3&&lt<5.42?.6:lt>5.5&&lt<5.62?.5:0);
  if(lt>10.1&&lt<10.75){const fall=ein(seg(lt,10.2,10.6)),bb=lt>10.6?Math.sin(seg(lt,10.6,10.72)*Math.PI)*-20:0;STACK.forEach(([bx,by])=>barrel(bx,GY+by-(1-fall)*1500+bb,1.5,0))}},
 actors(lt,S){const a=[];if(S.d)a.push([DIDDY,S.d]);a.push([EGG,S.v]);a.push([DK,S.h,1]);return a},
 front(lt,S){if(S.d&&S.d.pop){const g=toW(DIDDY,S.d,40,-60);x.save();x.translate(g[0],g[1]);LW=1;sticker(()=>{rr(-10,-12,46,18,4,'#8a5a2a');rr(-6,0,12,22,3,'#6a3e1e')});x.restore()}
  PNUT.forEach(t=>{const k=lt-t;if(k<0||k>.16||lt>8.3)return;const u=k/.16;const px=lerp(this.hx-120,this.vx-60,u),py=lerp(GY-150,GY-300,u)-Math.sin(u*Math.PI)*60;x.save();x.translate(px,py);x.rotate(u*8);LW=1.2;sticker(()=>{sh('#e8c27a',()=>{x.ellipse(-8,0,12,9,0,0,TAU);x.moveTo(20,0);x.ellipse(8,0,12,9,0,0,TAU)})});LW=1;x.restore()});
  if(lt>=10.75&&lt<12.3){const k=lt-10.75;STACK.forEach(([bx,by],i)=>{const a=-Math.PI/2+(i-2.5)*.55,v=900+hs(i)*500;const px=bx+Math.cos(a)*v*k,py=GY+by+Math.sin(a)*v*k+1400*k*k;if(py<H+200)barrel(px,py,1.5,k*(6+i))})}
  if(lt>=11.0&&lt<11.8){const k=(lt-11)/.8;x.save();x.globalAlpha=1-k;x.fillStyle='#ffb62e';x.strokeStyle=INK;x.lineWidth=8;x.beginPath();burst(820,GY-200,12,260+k*260,160+k*160,k);x.fill();x.stroke();x.fillStyle='#fff3a0';x.beginPath();burst(820,GY-200,10,150+k*180,90+k*90,-k);x.fill();x.restore()}},
 events(L){const E=[];
  E.push([4.72,()=>{sfx('whoosh');pop(L.hx-160,GY-420,'DIDDY!','#ff8a8a',true)}],[5.05,()=>sfx('step')],[5.4,()=>{sfx('boing');pop(L.hx-200,GY-260,'BOING!','#ffe14a',true)}],[5.6,()=>sfx('boing')]);
  E.push([6.02,()=>{const S=L.pose(6.0199);const f=footW(DK,S.h,[16,-48],22,20,16);const b=boxW(EGG,S.v);G.qa.push([3,'dkkick',6.02,inBox(f,b)?'OK':'MISS',Math.round(f[0]),Math.round(f[1]),Math.round(b.x),Math.round(b.y)]);hit(f[0],f[1],{w:'PARTNER KICK!',big:true,n:3})}]);
  E.push([6.07,()=>{const S=L.pose(6.0699);const f=footW(DIDDY,S.d,[6,-30],14,13,10);const b=boxW(EGG,S.v);G.qa.push([3,'diddykick',6.07,inBox(f,b)?'OK':'MISS',Math.round(f[0]),Math.round(f[1]),Math.round(b.x),Math.round(b.y)]);hit(f[0],f[1],{w:null,big:true,n:2})}]);
  PNUT.forEach((t,i)=>{E.push([t,()=>sfx('gun',.6)]);E.push([t+.16,()=>hit(L.vx-60,GY-300,{w:i%3==0?'PEANUT!':null,n:1,stop:.012,cnt:6,cols:['#e8c27a','#fff']})])});
  E.push([STD.fin,()=>banner('BARREL BARRAGE!')],[10.1,()=>{sfx('whoosh');pop(L.vx,GY-560,'GRAB!','#ffe14a',true)}],[10.3,()=>pop(L.vx-40,GY-640,'WAAAH!','#ff8a8a',false)],[10.25,()=>sfx('whoosh')],[10.6,()=>{sfx('big',.6);G.shake=14}]);
  E.push([10.75,()=>{const S=L.pose(10.749);const c=S.v.cx||[760,GY-190];hit(c[0]+60,c[1],{w:'SMASH!!',big:true,n:4,stop:.22,cols:['#a5612a','#e8c27a','#fff']});spark(820,GY-200,30,['#a5612a','#6e3714','#ffd23a'])}]);
  E.push([11.0,()=>{sfx('boom');G.flash=.4;G.shake=36;if(G.ph!=='replay')addCombo(2)}],[11.5,()=>koCall()]);
  return E}});
