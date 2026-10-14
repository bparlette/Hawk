// ================= WORLD 1: MUSHROOM HILL — Sonic (+Master Sword) vs Bowser =================
const BLK=[...Array(8)].map((_,i)=>[250+i*84,690-Math.sin(i/7*Math.PI)*120]);
const TB=BLK.map((_,i)=>5.1+i*.13);
const PB={x:150,top:700,ledge:860};
const L1=mkLevel({id:1,seed:101,wtag:'WORLD 1',name:'MUSHROOM HILL',title:'WORLD 1 · MUSHROOM HILL',vs:'SONIC  vs  BOWSER',
 hn:'SONIC',hsub:"+ LINK'S MASTER SWORD",vn:'BOWSER',vsub:'KING OF THE KOOPAS',hero:SONIC,vil:BOWSER,wpn:'master',vw:'claw',
 hx:330,vx:660,lunge:56,vLunge:106,vAtk:'claw',root:110,cWord:'CHOMP!',
 words:['SLASH!','WHAM!','SWISH!','BONK!','KRAK!'],wRush:'SPIN!',wEnd:'SMAAASH!',
 extraHits:[[6.6,'slash'],[7.0,'jab'],[7.45,'upper']],extraVHit:TB.map(t=>t+.55),
 koT:10.35,replayAt:10.35,endT:12.85,mS:9.95,mE:12.35,bg:bgMushroom,
 pose(lt){if(lt<4.7||(lt>=6.35&&lt<STD.fin))return stdPose(this,lt);const h=H0(this,lt),v=V0(this,lt);react(v,lt,this.vHit);
  if(lt<6.35){// spin dash through the ? blocks
   h.ball=1;h.ballA=lt*34;const keys=[[4.95,this.hx,GY-98]];TB.forEach((t,i)=>keys.push([t,BLK[i][0],BLK[i][1]+111]));keys.push([6.12,930,1000],[6.34,this.hx,GY-98]);
   if(lt<4.95){h.x+=Math.sin(lt*80)*4}else{const p=path(keys,lt,40);h.x=p[0];h.y=p[1]+98}
   if(lt>5.0&&lt<6.3)v.B=[2.6,.4];return{h,v}}
  // finisher
  const k1=seg(lt,10.05,10.35);h.x+=ease(k1)*112;
  if(lt<10.25)h.kick=seg(lt,10.05,10.25)*.3;else if(lt<10.35)h.kick=lerp(.3,1,seg(lt,10.25,10.35));else if(lt<10.55)h.kick=1;else h.kick=1-seg(lt,10.55,10.8);
  if(lt>10.8)h.x=lerp(this.hx+112,this.hx,ease(seg(lt,10.8,11.2)));h.lean=-.18*(h.kick||0);if(h.kick>.05)h.A=[.5,1.3,-1.1];
  if(lt>12.25){h.A=VICT;h.y=GY-Math.abs(Math.sin((lt-12.25)*6))*30}
  const pm=this.pipeA(lt);
  if(lt>=10.35&&lt<10.62){const u=ein(seg(lt,10.35,10.62));v.x=lerp(this.vx+20,pm+260,u);v.sy=lerp(1,.4,u);v.hurt=1;v.flash=lt<10.4?1:0;v.rot=0}
  else if(lt>=10.62&&lt<10.95)v.hide=1;
  else if(lt>=10.95){v.hurt=1;v.sc=.5;v.shadow=false;const cy=112*2.3*.5;
   if(lt<11.45){const u=seg(lt,10.95,11.45),p=[lerp(PB.x,LOOP.x-110,u),lerp(PB.top,LOOP.y+LOOP.R-70,u)-Math.sin(u*Math.PI)*380];v.x=p[0];v.y=p[1]+cy;v.rot=u*9}
   else if(lt<12.1){const u=seg(lt,11.45,12.1),th=Math.PI/2+.5-u*(TAU+.5),r=LOOP.R-14-cy;const C=[LOOP.x+Math.cos(th)*r,LOOP.y+Math.sin(th)*r];v.x=C[0];v.y=C[1]+cy;v.rot=th-Math.PI/2}
   else{const u=seg(lt,12.1,12.5);v.x=lerp(LOOP.x,W+260,u);v.y=lerp(LOOP.y+LOOP.R-14,180,u)+cy;v.rot=u*14;if(lt>12.5)v.hide=1}}
  return{h,v}},
 pipeA(lt){return lerp(W+80,this.vx+96,eout(seg(lt,9.8,10.1)))+(lt>10.55&&lt<10.95?Math.sin(lt*90)*6:0)},
 back(lt,S,cam){const c=cam;BLK.forEach((b,i)=>{const k=lt-TB[i],bump=k>=0&&k<.15?-22*Math.sin(k/.15*Math.PI):0;qblock(b[0]-c,b[1]+bump,74,lt>=TB[i]&&lt>0,lt)});
  [[60,560],[980,600]].forEach(b=>brick(b[0]-c,b[1],70));
  if(lt>10.3){const top=lerp(PB.ledge,PB.top,eout(seg(lt,10.4,10.7)));for(let i=0;i<4;i++)brick(PB.x-105+i*70-c,PB.ledge+35,70);pipeV(PB.x-c,top,PB.ledge,150)}
  if(lt<10.35&&lt>9.7)pipeH(this.pipeA(lt)-c,GY-190,W+200,230);
  if(lt>=10.95&&!S.v.hide){drawChar(BOWSER,S.v);S.v.hide=2}},
 actors(lt,S){const l=[];if(S.v.hide!==2)l.push([BOWSER,S.v]);l.push([SONIC,S.h,1]);return l},
 front(lt,S,cam){if(S.v.hide===2)S.v.hide=0;
  TB.forEach((t,i)=>{const k=lt-t;if(k<0||lt<0||k>1.1||lt>9)return;const b=BLK[i];let p;
   if(k<.2)p=[b[0],b[1]-40-k/.2*40];else if(k<.55){const u=seg(k,.2,.55);p=[lerp(b[0],this.vx-30,u),lerp(b[1]-80,GY-470,u)-Math.sin(u*Math.PI)*120]}else{const u=seg(k,.55,1.1);p=[lerp(this.vx-30,this.vx+160+i*25,u),lerp(GY-470,GY-1000,u)+u*u*500]}
   mushroom(p[0],p[1],1.4,k*3)});
  if(lt>=10.35&&lt<10.95)pipeH(this.pipeA(lt),GY-190,W+200,230);
  if(lt>12.5&&lt<13.2){const k=(lt-12.5)/.7;x.save();x.translate(980,300);x.rotate(k*4);x.globalAlpha=1-k;x.fillStyle='#fff';x.strokeStyle=INK;x.lineWidth=5;x.beginPath();star5(0,0,60*(1+k),24);x.fill();x.stroke();x.restore()}},
 tick(lt,d){if(lt>4.7&&lt<4.95&&hs(Math.floor(lt*60))<.5)spark(this.hx-40,GY-10,1,['#e8d8b0','#ffffff'])},
 events(L){const E=[];
  E.push([4.72,()=>{sfx('power',.7);pop(L.hx,GY-460,'SPIN DASH!','#9de8ff',true)}],[4.95,()=>sfx('whoosh')]);
  TB.forEach((t,i)=>{E.push([t,()=>{const b=BLK[i];hit(b[0],b[1]+40,{w:i%2?'DING!':'?!',n:1,stop:.015,cnt:10,snd:'ding',shk:8,cols:['#ffd23a','#fff']});sfx('mush',.6)}]);
   E.push([t+.55,()=>{const S=L.pose(t+.55);hit(L.vx-30,GY-470,{w:'BOP!',n:1,stop:.015,cnt:10,col:'#ff8a8a'})}])});
  E.push([6.25,()=>pop(L.vx,GY-640,'MUSHROOM RAIN!','#ff8a8a',true)]);
  E.push([STD.fin,()=>banner('WARP PIPE CANNON!')],[9.8,()=>sfx('whoosh')]);
  E.push([10.35,()=>{const S=L.pose(10.35);const f=footW(SONIC,S.h,[6,-46],22,21,18);const b=boxW(BOWSER,S.v);G.qa.push([1,'kick',10.35,inBox(f,b)?'OK':'MISS',Math.round(f[0]),Math.round(f[1]),Math.round(b.x),Math.round(b.y)]);hit(f[0],f[1],{w:'KICK!',big:true,n:3,stop:.2})}]);
  E.push([10.45,()=>sfx('pipe')],[10.6,()=>pop(L.pipeA(10.6)+120,GY-380,'GLUP!','#7cff6a',true)]);
  E.push([10.95,()=>{sfx('pipeout');spark(PB.x,PB.top,24,['#7cff6a','#ffffff']);pop(PB.x+80,PB.top-120,'FWOOMP!','#7cff6a',true);if(G.ph!=='replay')addCombo(1)}]);
  E.push([11.5,()=>{sfx('whoosh');pop(LOOP.x,LOOP.y-LOOP.R-90,'LOOP-DE-LOOP!','#ffe14a',true)}],[11.8,()=>sfx('whoosh')]);
  E.push([12.1,()=>{hit(LOOP.x,LOOP.y+LOOP.R-60,{w:null,big:true,n:2,stop:.06})}],[12.2,()=>koCall()],[12.5,()=>sfx('star')]);
  return E}});
