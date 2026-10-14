// ================= WORLD 4: STREETS OF DREAM LAND — Kirby (+Axel's lead pipe) vs Mr. X and two goons =================
const G2X=820,MXX=965;
const STAR_T=[...Array(15)].map((_,i)=>5.25+i*.15),STAR_TG=[0,1,2,2,1,0,0,1,2,2,1,0,1,2,0];
const L4=mkLevel({id:4,seed:404,wtag:'WORLD 4',name:'STREETS OF DREAM LAND',title:'WORLD 4 · STREETS OF DREAM LAND',vs:'KIRBY  vs  MR. X + GOONS',
 hn:'KIRBY',hsub:"+ AXEL'S LEAD PIPE",vn:'MR. X',vsub:'+ 2 GOONS',hero:KIRBY,vil:GOON1,wpn:'pipe',vw:'fist',
 hx:320,vx:620,lunge:40,vLunge:150,vAtk:'low',root:104,cWord:'BAM!',
 words:['CLANG!','BONK!','KLONK!','THUNK!','POW!'],wRush:'PIPE RUSH!',wEnd:'KA-KLANG!',
 koT:12.0,replayAt:12.0,endT:12.95,mS:10.45,mE:12.6,bg:bgStreets,
 walkPose(w){return{x:0,y:GY-Math.abs(Math.sin(w*.8))*26,face:1,wpn:'pipe',t:w,A:[.3,2.4,-.6]}},
 tgt(i,S){return i==0?S.v:i==1?S.g2:S.mx},
 tdef(i){return i==0?GOON1:i==1?GOON2:MRX},
 starPos(lt){const C=[[this.vx,GY-200],[G2X,GY-200],[MXX,GY-250]];const keys=[[5.0,this.hx,GY-130]];STAR_T.forEach((t,i)=>{const c=C[STAR_TG[i]];keys.push([t,c[0],c[1]+(i%2?-60:60)])});keys.push([7.6,this.hx,GY-130]);
  if(lt<5.0){const u=eout(seg(lt,4.7,5.0));return[lerp(-250,this.hx,u),lerp(380,GY-130,u)]}if(lt<7.6)return path(keys,lt,150);const u=ein(seg(lt,7.6,7.95));return[lerp(this.hx,-300,u),lerp(GY-130,300,u)]},
 pose(lt){let S;if(lt<4.7||(lt>=7.6&&lt<STD.fin))S=stdPose(this,lt);else{const h=H0(this,lt),v=V0(this,lt);S={h,v};react(v,lt,this.vHit)}
  const g2={x:G2X,y:GY,face:-1,t:lt+3,wpn:'fist',A:restA(lt+3)},mx={x:MXX,y:GY,face:-1,t:lt,wpn:'none',A:restA(lt+5),B:[.2,.3]};S.g2=g2;S.mx=mx;
  const T=[[],[],[]];STAR_T.forEach((t,i)=>T[STAR_TG[i]].push(t));react(g2,lt,T[1]);react(mx,lt,T[2].concat([11.55,11.7,11.85]));if(lt<7.6)react(S.v,lt,T[0]);
  const h=S.h,v=S.v;
  if(lt>=4.7&&lt<7.95){S.star=this.starPos(lt);if(lt>=5.0&&lt<7.6){h.x=S.star[0];h.y=S.star[1]-30;h.sc=.8;h.shadow=false;h.A=[.9,1.2,-1.1]}}
  if(lt>=STD.fin){// COPY ALL
   if(lt<10.55){h.inhale=seg(lt,9.85,10.0);const u=ein(seg(lt,10.0,10.55));v.x=lerp(this.vx,this.hx+90,u);v.sc=lerp(1,.2,u);v.rot=-u*8;v.hurt=1;v.y=GY-u*60;v.shadow=u<.5;h.A=[.5,1,-1]}
   else{v.hide=1;if(lt<10.8)h.puff=1}
   if(lt>=10.95){const u=seg(lt,10.95,11.4);g2.x=lerp(G2X,W+300,u);g2.y=GY-Math.sin(u*Math.PI)*400-u*200;g2.rot=u*10;g2.hurt=1;if(lt>11.4)g2.hide=1}
   if(lt>=11.05){h.hat=1;h.wsc=lerp(1,2.1,eback(seg(lt,11.05,11.3)))}
   if(lt>=11.3&&lt<12.15){const u=seg(lt,11.3,11.95);h.x=lerp(this.hx,760,ease(u));h.spin=1;const a=lt*26;h.A=[Math.PI/2,0,0];h.face=(lt>11.86||Math.cos(a)>0)?1:-1;if(lt>11.86)h.A=[lerp(2.6,1.45,ease(seg(lt,11.86,12.0))),0,-.1];h.sy=1}
   if(lt>=12.15){h.x=lerp(760,this.hx,ease(seg(lt,12.15,12.6)));h.y=GY-Math.sin(seg(lt,12.15,12.6)*Math.PI)*160;h.wsc=lerp(2.1,1,seg(lt,12.15,12.4))}
   if(lt>=11.4&&lt<12.0){const u=seg(lt,11.4,12.0);mx.x=lerp(MXX,MXX-60,u)+Math.sin(lt*40)*8;mx.lean=-.2;mx.hurt=1}
   if(lt>=12.0){const u=seg(lt,12.0,12.55);mx.x=lerp(MXX-60,MXX+140,u);mx.y=GY-u*1500;mx.rot=u*14;mx.hurt=1;mx.shadow=false;if(lt>12.55)mx.hide=1}
   if(lt>12.6)h.A=VICT}
  return S},
 actors(lt,S){return[[MRX,S.mx],[GOON2,S.g2],[GOON1,S.v],[KIRBY,S.h,1]]},
 back(lt,S){if(S.star&&lt>=4.7){const p=S.star;x.save();x.globalAlpha=.55;const C=['#ff4f7a','#ffb02e','#ffe14a','#5fe07a','#4fb0ff'];for(let i=0;i<5;i++){const q=this.starPos(lt-.05*(i+1));x.strokeStyle=C[i];x.lineWidth=26;x.lineCap='round';x.beginPath();x.moveTo(p[0],p[1]+40);x.lineTo(q[0],q[1]+40);x.stroke()}x.restore();warpStar(p[0],p[1]+40,1.25,lt*4)}},
 front(lt,S){const h=S.h;
  if(lt>9.85&&lt<10.6){x.save();x.strokeStyle='rgba(255,255,255,.75)';x.lineCap='round';for(let i=0;i<9;i++){const k=((lt*3+i/9)%1),y0=GY-120+(hs(i)-.5)*260;x.lineWidth=10;x.beginPath();x.moveTo(lerp(900,this.hx+120,k),lerp(y0,GY-100,k));x.lineTo(lerp(900,this.hx+120,k)+90,lerp(y0,GY-100,k));x.stroke()}x.restore()}
  if(lt>=10.75&&lt<10.95){const u=seg(lt,10.75,10.95);warpStar(lerp(this.hx+90,G2X,u),lerp(GY-110,GY-200,u),.9,lt*20)}
  if(lt>=11.3&&lt<12.15){x.save();x.globalAlpha=.62;for(let i=0;i<7;i++){const r=lerp(110,330,i/6),y=GY-40-i*85;x.strokeStyle=i%2?'#bfe9ff':'#ffffff';x.lineWidth=18;x.beginPath();x.ellipse(h.x+Math.sin(lt*20+i)*20,y,r,r*.28,0,(lt*14+i)%TAU,(lt*14+i)%TAU+4.2);x.stroke()}x.restore()}},
 events(L){const E=[];
  E.push([4.72,()=>{sfx('star');pop(L.hx,GY-560,'WARP STAR!','#ffe14a',true)}]);
  STAR_T.forEach((t,i)=>E.push([t,()=>{const S=L.pose(t);const o=L.tgt(STAR_TG[i],S),b=boxW(L.tdef(STAR_TG[i]),o);hit(b.x,b.y,{w:['STAR!','WHOOSH!','ZOOM!'][i%3],n:1,stop:.02,cnt:10,cols:['#ffe14a','#fff','#ff9af0']})}]));
  E.push([STD.fin,()=>banner('COPY ALL!')],[9.9,()=>sfx('suck')],[10.55,()=>{sfx('spit',.6);pop(L.hx+20,GY-420,'GULP!','#ff9af0',true)}]);
  E.push([10.75,()=>{sfx('spit');sfx('star',.6)}],[10.95,()=>{const S=L.pose(10.95);const b=boxW(GOON2,S.g2);hit(b.x,b.y,{w:'STAR SPIT!',big:true,n:2})}]);
  E.push([11.05,()=>{sfx('power');G.flash=.6;pop(L.hx,GY-480,'COPY: PIPE!','#ffe14a',true)}],[11.3,()=>{sfx('whoosh');pop(540,GY-720,'PIPE TORNADO!','#9de8ff',true)}]);
  [11.55,11.7,11.85].forEach(t=>E.push([t,()=>{const S=L.pose(t);const b=boxW(MRX,S.mx);hit(b.x-20,b.y,{w:null,n:1,stop:.02,cnt:10})}]));
  E.push([12.0,()=>{const S=L.pose(12.0);const tip=tipW(KIRBY,Object.assign({},S.h,{face:1})),b=boxW(MRX,S.mx);G.qa.push([4,'tornado',12,(tip[0]>b.x-b.rx)?'OK':'MISS',Math.round(tip[0]),Math.round(tip[1]),Math.round(b.x),Math.round(b.y)]);hit(b.x-20,b.y-40,{w:'WHIRL!',big:true,n:3,stop:.2})}],[12.3,()=>koCall()]);
  E.push([12.0,()=>sfx('whoosh')]);
  return E}});
