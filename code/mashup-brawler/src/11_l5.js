// ================= WORLD 5: ZEBES GOLDEN AXE — Samus (+Ax Battler's broadsword) vs Metal Sonic =================
SAMUS.dip=-.45;
const MSL=[...Array(10)].map((_,i)=>6.6+i*.11),BOMBH=[5.85,5.92,5.99];
function bolt(x0,y0,x1,y1,sd,w){const N=9,pts=[];for(let i=0;i<=N;i++){const u=i/N;pts.push([lerp(x0,x1,u)+(i&&i<N?(hs(sd+i)-.5)*120:0),lerp(y0,y1,u)])}
 x.save();x.lineJoin='round';x.lineCap='round';const st=c=>{x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke()};
 x.globalAlpha=.4;x.strokeStyle='#9de8ff';x.lineWidth=w*4;st();x.globalAlpha=1;x.strokeStyle='#fff';x.lineWidth=w+12;st();x.strokeStyle=INK;x.lineWidth=w+5;st();x.strokeStyle='#fff6a8';x.lineWidth=w;st();x.restore()}
const L5=mkLevel({id:5,seed:505,wtag:'WORLD 5',name:'ZEBES GOLDEN AXE',title:'WORLD 5 · ZEBES GOLDEN AXE',vs:'SAMUS  vs  METAL SONIC',
 hn:'SAMUS',hsub:"+ AX BATTLER'S BROADSWORD",vn:'METAL SONIC',vsub:'ROBOT REPLICA',hero:SAMUS,vil:METAL,tmap:{upper:'slash'},wpn:'broad',vw:'fist',
 hx:320,vx:620,lunge:60,vLunge:140,vAtk:'jab',root:82,cWord:'METAL PUNCH!',
 words:['SLICE!','CLANG!','SCHWING!','KRANG!','SLASH!'],wRush:'AXE RUSH!',wEnd:'CRUNCH!',
 extraVHit:BOMBH.concat(MSL.map(t=>t+.12)).concat([7.95]),
 koT:11.2,replayAt:11.2,endT:12.5,mS:10.15,mE:12.3,bg:bgZebes,
 pose(lt){let S;if(lt<4.7||(lt>=8.0&&lt<STD.fin))S=stdPose(this,lt);else{const h=H0(this,lt),v=V0(this,lt);S={h,v};react(v,lt,this.vHit);const hx=this.hx;
   if(lt<8.0){// super phase + morph ball between the legs
    if(lt<5.1){v.y=GY-seg(lt,4.7,5.0)*60;v.B=[2.6,.3];v.A=[2.6,.3,-.5]}
    else if(lt<5.45){const u=seg(lt,5.1,5.45);v.x=lerp(this.vx,hx+140,u);v.y=lerp(GY-60,GY-420,eout(u));v.jump=1}
    else if(lt<5.6){const u=ein(seg(lt,5.45,5.6));v.x=hx+140;v.y=lerp(GY-420,GY,u);v.jump=1}
    else if(lt<5.85){v.x=hx+140;v.sy=1-.15*Math.sin(seg(lt,5.6,5.75)*Math.PI);v.hurt=0;v.walk=0;v.kick=0;v.B=[1.2,.2]}
    else if(lt<6.3){const u=eout(seg(lt,5.85,6.3));v.x=lerp(hx+140,hx+260,u);v.y=lerp(GY,GY-520,u);v.rot=u*2;v.hurt=1}
    else if(lt<7.72){v.x=hx+260+Math.sin(lt*30)*6;v.y=GY-520+Math.sin(lt*4)*14;v.rot=2+Math.sin(lt*3)*.2;v.hurt=1}
    else{const u=ein(seg(lt,7.72,7.95));v.x=lerp(hx+260,this.vx,u);v.y=lerp(GY-520,GY,u);v.rot=lerp(2,TAU,u);if(lt>7.95)v.rot=0}
    if(lt>=5.25&&lt<6.5){h.ball=1;h.ballA=lt*20;
     if(lt<5.35){}else if(lt<5.85){h.x=lerp(hx,this.vx+60,seg(lt,5.35,5.85))}else if(lt<6.0){h.x=this.vx+60}else{const u=seg(lt,6.0,6.45);h.x=lerp(this.vx+60,hx,u);h.y=GY-Math.sin(u*Math.PI)*560}}
    if(lt>=6.5&&lt<7.8){h.B=[2.35,.05];h.A=restA(lt);h.lean=-.06}}
   else{// AXE BOMB ARMAGEDDON
    if(lt<10.35){h.B=[2.6,.3];h.A=[2.5,.4,-.6]}
    if(lt>=10.75&&lt<11.2){v.lean=-.15;v.A=[2.8,.2,-.5]}
    if(lt>=11.15&&lt<11.3){v.flash=Math.floor(lt*40)%2;v.hurt=1}
    if(lt>=11.3){const u=seg(lt,11.3,11.9);v.x=lerp(this.vx,W+250,u);v.y=GY-Math.sin(u*Math.PI*.7)*900-u*300;v.rot=u*16;v.hurt=1;v.shadow=false;if(lt>11.9)v.hide=1}
    if(lt>11.9){h.A=VICT;h.y=GY-Math.abs(Math.sin((lt-11.9)*6))*30}}}
  if(lt>=4.7)S.v.super=1;return S},
 actors(lt,S){return[[METAL,S.v],[SAMUS,S.h,1]]},
 back(lt,S){if(lt>5.58&&lt<5.85)bobomb(this.hx+140,GY-30,.7,lt,1);if(lt>5.95&&lt<6.0)bobomb(this.vx+60,GY-30,.6,lt,1)},
 front(lt,S){const h=S.h;
  MSL.forEach(t=>{const k=lt-t;if(k<0||k>.12)return;const u=k/.12;const c=toW(SAMUS,h,30,-150),tg=[this.hx+260,GY-520-120];const px=lerp(c[0],tg[0],u),py=lerp(c[1],tg[1],u),a=Math.atan2(tg[1]-c[1],tg[0]-c[0]);x.save();x.translate(px,py);x.rotate(a);LW=1.2;sticker(()=>{rr(-26,-9,52,18,9,'#e2562a');poly([26,-9,44,0,26,9],'#9aa4ae')});LW=1;x.fillStyle='#ffb62e';x.beginPath();x.moveTo(-26,-7);x.lineTo(-56,0);x.lineTo(-26,7);x.fill();x.restore()});
  if(lt>=5.85&&lt<6.15){const k=(lt-5.85)/.3;x.save();x.globalAlpha=1-k;x.fillStyle='#ffe14a';x.strokeStyle=INK;x.lineWidth=6;x.beginPath();burst(this.hx+140,GY-40,10,90+k*140,50+k*80);x.fill();x.stroke();x.restore()}
  if(lt>=10.05&&lt<11.3){let p;if(lt<10.5){const u=seg(lt,10.05,10.5);p=[lerp(this.hx+60,this.vx-70,u),lerp(GY-320,GY-40,u)-Math.sin(u*Math.PI)*300]}else p=[this.vx-70,GY-40];bobomb(p[0],p[1],1.1,lt,lt>10.5)}
  if(lt>=10.3&&lt<10.7){const u=seg(lt,10.3,10.7);magicPot(lerp(this.hx+60,this.vx-10,u),lerp(GY-330,GY-360,u)-Math.sin(u*Math.PI)*320,1.6,u*8)}
  if(lt>=10.7&&lt<11.6){const k=seg(lt,10.7,10.95)*(1-seg(lt,11.35,11.6));x.fillStyle=`rgba(8,10,40,${.62*k})`;x.fillRect(-50,-50,W+100,H+100)}
  if(lt>=11.15&&lt<11.55&&Math.floor(lt*24)%3!=2){const sd=Math.floor(lt*12)*13;bolt(this.vx+20,-40,this.vx-10,GY-200,sd,22);[90,260,420,760,930,1040].forEach((bx,i)=>bolt(bx,-40,bx+(hs(i+sd)-.5)*200,GY-hs(i*7+sd)*500,sd+i*29,12))}
  if(lt>=11.3&&lt<12.2){const k=(lt-11.3)/.9;x.save();x.globalAlpha=1-k;x.fillStyle='#ff7a1a';x.strokeStyle=INK;x.lineWidth=8;x.beginPath();burst(this.vx-60,GY-200,14,320+k*420,200+k*260,k);x.fill();x.stroke();x.fillStyle='#ffe14a';x.beginPath();burst(this.vx-60,GY-200,12,200+k*300,120+k*160,-k);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(this.vx-60,GY-200,120*(1-k),0,TAU);x.fill();x.restore()}},
 events(L){const E=[];
  E.push([4.72,()=>{sfx('power');G.flash=.45;pop(L.vx,GY-560,'SUPER BOSS PHASE!','#ffe14a',true);if(G.ph!=='replay')G.hpV=100}],[5.1,()=>sfx('whoosh')],[5.25,()=>{sfx('zap');pop(L.hx,GY-300,'MORPH BALL!','#7cff6a',true)}]);
  E.push([5.6,()=>{spark(L.hx+140,GY,20,['#e8d8b0','#fff']);G.shake=24;sfx('big',.7);pop(L.hx+140,GY-520,'MISS!','#ffffff',false)}],[5.58,()=>sfx('step')]);
  BOMBH.forEach((t,i)=>E.push([t,()=>{const S=L.pose(t);const b=boxW(METAL,S.v);hit(b.x,b.y+60,{w:i==0?'BOMB!':null,n:1,snd:i==0?'boom':'hit',stop:.03,cnt:14,cols:['#ffe14a','#ff7a1a','#fff']})}]));
  E.push([5.97,()=>{sfx('hit',.6);spark(L.vx+60,GY-20,12,['#ffe14a','#fff'])}],[6.5,()=>sfx('zap')]);
  MSL.forEach((t,i)=>{E.push([t,()=>sfx('gun',.7)]);E.push([t+.12,()=>{const S=L.pose(t+.12);const b=boxW(METAL,S.v);hit(b.x-10,b.y,{w:i%3==0?'MISSILE!':null,n:1,stop:.012,cnt:8,cols:['#ffb62e','#fff']})}])});
  E.push([7.95,()=>hit(L.vx,GY-60,{w:'CRASH!',big:true,n:2,stop:.1,cols:['#e8d8b0','#fff']})]);
  E.push([STD.fin,()=>banner('AXE BOMB ARMAGEDDON!')],[10.05,()=>{sfx('whoosh');pop(L.hx+60,GY-640,'BOB-OMB!','#ffffff',true)}],[10.3,()=>sfx('whoosh')],[10.5,()=>sfx('step')]);
  E.push([10.7,()=>{sfx('zap');spark(L.vx-10,GY-360,26,['#2f6fe0','#9fd0ff','#fff']);pop(L.vx-10,GY-560,'MAGIC POT!','#9fd0ff',true)}],[10.75,()=>sfx('power',.6)]);
  E.push([11.2,()=>{const b=boxW(METAL,L.pose(11.2).v);hit(b.x,b.y,{w:'THUNDER!!',big:true,n:4,snd:'thunder',stop:.18,cnt:30,cols:['#fff6a8','#9de8ff','#fff']});G.flash=.95}]);
  E.push([11.3,()=>{sfx('boom');G.shake=40;spark(L.vx-60,GY-200,40,['#ff7a1a','#ffe14a','#9aa4ae','#fff']);if(G.ph!=='replay')addCombo(3)}],[11.75,()=>koCall()]);
  return E}});
