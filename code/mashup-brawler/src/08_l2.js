// ================= WORLD 2: HYRULE CASINO — Mario (+Knuckles' spiked fists) vs Ganondorf =================
const SEQ=[1,0,3,5,4,2,1,3,0,5,2,4],TBN=SEQ.map((_,k)=>10.45+k*.14);
const LUH=[6.65,6.95,7.25,7.55,7.85];
const L2=mkLevel({id:2,seed:202,wtag:'WORLD 2',name:'HYRULE CASINO',title:'WORLD 2 · HYRULE CASINO',vs:'MARIO  vs  GANONDORF',
 hn:'MARIO',hsub:"+ KNUCKLES' SPIKED FISTS",vn:'GANONDORF',vsub:'KING OF EVIL',hero:MARIO,vil:GANON,wpn:'fists',vw:'fist',
 hx:330,vx:600,lunge:50,vLunge:78,vAtk:'low',root:98,cWord:'WARLOCK PUNCH!',
 words:['POW!','WHAP!','THWACK!','BIFF!','KAPOW!'],wRush:'ORA ORA!',wEnd:'BOOM!',
 extraHits:[[6.5,'jab'],[6.8,'slash'],[7.1,'jab'],[7.4,'upper'],[7.7,'slash']],extraVHit:[5.62,6.15].concat(LUH),
 koT:10.2,replayAt:10.2,endT:12.9,mS:9.95,mE:12.45,
 bg(cam,lt){bgCasino(cam,lt,L2.lit(lt))},
 lit(lt){return BUMP.map((_,i)=>{let v=0;SEQ.forEach((b,k)=>{if(b===i){const d=lt-TBN[k];if(d>=0&&d<.3)v=Math.max(v,1-d/.3)}});return v})},
 luigi(lt){const o={x:this.vx+242,y:GY,face:-1,wpn:'none',t:lt,A:restA(lt+2)};
  if(lt<4.7||lt>8.4)return null;
  if(lt<5.05){o.y=lerp(-500,GY,ein(seg(lt,4.7,5.05)));o.jump=1}else if(lt<5.2){o.sy=1-.2*Math.sin(seg(lt,5.05,5.2)*Math.PI)}
  else if(lt<5.62){const u=seg(lt,5.2,5.62);o.x=lerp(this.vx+242,this.vx+182,u);o.walk=lt*16;o.A=[1.57,0,-.05];o.y=GY-Math.sin(seg(lt,5.35,5.85)*Math.PI)*140}
  else if(lt<6.3){o.A=[1.57,0,-.05];o.y=GY-Math.sin(seg(lt,5.35,5.85)*Math.PI)*140;o.x=lerp(this.vx+182,this.vx+242,ease(seg(lt,5.8,6.3)));if(lt>5.85)o.A=restA(lt)}
  else if(lt<8.0){const st=strikeIn(lt,LUH.map((t,i)=>[t,i%2?'slash':'jab']));if(st){o.A=kfA(st.type,st.k);o.atk=st;o.x-=clamp(1-Math.abs(st.k)/.16)*40}}
  else{o.jump=1;o.y=lerp(GY,-600,ein(seg(lt,8.0,8.4)))}
  return o},
 pose(lt){let S;if(lt<4.7||(lt>=6.3&&lt<STD.fin))S=stdPose(this,lt);else{const h=H0(this,lt),v=V0(this,lt);react(v,lt,this.vHit);S={h,v};
  if(lt<6.3){// double clothesline
   if(lt>=5.2&&lt<5.62){const u=seg(lt,5.2,5.62);h.x=lerp(this.hx,this.vx-216,u);h.walk=lt*16;h.A=[1.57,0,-.05]}
   if(lt>=5.2&&lt<6.3)h.y=GY-Math.sin(seg(lt,5.35,5.85)*Math.PI)*140;
   if(lt>=5.62&&lt<6.3){h.A=lt<5.85?[1.57,0,-.05]:restA(lt);h.x=lerp(this.vx-216,this.hx,ease(seg(lt,5.8,6.3)))}
   if(lt>=5.62&&lt<6.15){const u=seg(lt,5.62,6.15);v.rot=u*TAU;v.y=GY-Math.sin(u*Math.PI)*260;v.hurt=1}
   if(lt>=6.15&&lt<6.45){v.sy=1-.25*Math.sin(seg(lt,6.15,6.45)*Math.PI);v.hurt=1}}
  else{// PINBALL WIZARD
   if(lt<10.12){h.sy=1-.12*seg(lt,9.9,10.1);h.A=lt>9.9?[.2,.4,-.2]:h.A}
   const k=lt-10.2;if(k>-.12&&k<.7){h.A=kfA('upper',k);h.atk={type:'upper',k};h.x+=ease(seg(lt,10.02,10.2))*90}else if(lt>=10.9)h.x+=lerp(90,0,ease(seg(lt,10.9,11.3)));else if(lt>=10.2)h.x+=90;
   h.y=GY-Math.sin(seg(lt,10.1,10.78)*Math.PI)*270;if(lt>10.12&&lt<10.78)h.jump=1;
   if(lt>12.3){h.A=VICT;h.y=GY-Math.abs(Math.sin((lt-12.3)*6))*30}
   if(lt>10.2){v.hurt=1;v.sc=.55;v.shadow=false;const cy=120*2.25*.55;let p;
    if(lt<TBN[0]){const u=seg(lt,10.2,TBN[0]);p=[lerp(this.vx,BUMP[SEQ[0]][0],u),lerp(GY-300,BUMP[SEQ[0]][1]+90,u)]}
    else if(lt<TBN[11]){let kk=0;while(kk<10&&lt>=TBN[kk+1])kk++;const a=BUMP[SEQ[kk]],b=BUMP[SEQ[kk+1]],u=seg(lt,TBN[kk],TBN[kk+1]);const off=(q,o)=>[q[0]+o[0],q[1]+o[1]];const da=[b[0]-a[0],b[1]-a[1]],dl=Math.hypot(da[0],da[1]);const n=[da[0]/dl*95,da[1]/dl*95];p=[lerp(a[0]+n[0],b[0]-n[0],u),lerp(a[1]+n[1],b[1]-n[1],u)]}
    else{const u=seg(lt,TBN[11],12.4);const a=BUMP[SEQ[11]];p=[lerp(a[0],-300,u),lerp(a[1],-260,u)];if(lt>12.4)v.hide=1}
    v.x=p[0];v.y=p[1]+cy;v.rot=lt*16}}}
  S.l=this.luigi(lt);return S},
 actors(lt,S){const a=[[GANON,S.v]];if(S.l)a.push([LUIGI,S.l]);a.push([MARIO,S.h,1]);return a},
 front(lt){if(lt>11.2&&lt<12.12){const s=eback(clamp((lt-11.2)/.25));x.save();x.translate(540,380);x.scale(s,s);x.rotate(-.03);LW=1.6;sticker(()=>{rr(-300,-80,600,160,24,'#2a0a4a')});LW=1;
   for(let i=0;i<24;i++){x.fillStyle=(i+Math.floor(lt*10))%2?'#ffe14a':'#ff4fd8';x.beginPath();x.arc(-290+i*25.2,-72,6,0,TAU);x.arc(-290+i*25.2,72,6,0,TAU);x.fill()}
   stext('SCORE',-180,0,46,'#ff9af0',{shadow:false});stext(String(G.score).padStart(6,'0'),90,0,92,'#fff',{shadow:false,grad:['#fff9b0','#ffb21a']});x.restore()}},
 events(L){const E=[];
  E.push([4.72,()=>{sfx('whoosh');pop(L.vx+242,GY-760,"LUIGI!",'#7cff6a',true)}],[5.05,()=>{sfx('big',.6);spark(L.vx+242,GY,18,['#e8d8b0','#fff']);G.shake=18}]);
  E.push([5.62,()=>{const S=L.pose(5.62);const p1=contact(MARIO,S.h,GANON,S.v,'clothesline-M'),p2=contact(LUIGI,S.l,GANON,S.v,'clothesline-L');hit(p1[0],p1[1],{n:2,big:true});hit(p2[0],p2[1],{n:2,big:true,w:null});pop(540,GY-760,'DOUBLE CLOTHESLINE!','#ffe14a',true,-.06)}]);
  E.push([6.15,()=>hit(L.vx,GY-40,{w:'SLAM!',big:true,n:3,stop:.12,cols:['#e8d8b0','#fff']})]);
  LUH.forEach((t,i)=>E.push([t,()=>{const S=L.pose(t);const p=contact(LUIGI,S.l,GANON,S.v,'luigi'+i);hit(p[0],p[1],{w:i%2?'BROS!':'WAH!',n:1,col:'#7cff6a'})}]));
  E.push([STD.fin,()=>banner('PINBALL WIZARD!')]);
  E.push([10.2,()=>{const S=L.pose(10.2);const p=contact(MARIO,S.h,GANON,S.v,'uppercut');hit(p[0],p[1],{w:'UPPERCUT!',big:true,n:3,stop:.2})}]);
  TBN.forEach((t,k)=>E.push([t,()=>{const b=BUMP[SEQ[k]];hit(b[0],b[1],{w:'+1000',n:1,snd:'ping',stop:.02,cnt:12,shk:10,col:k%2?'#3ff0ff':'#ff9af0',cols:['#ff4fd8','#3ff0ff','#ffe14a','#fff']});if(G.ph!=='replay'){G.score+=1000;sfx('score',.5)}}]));
  E.push([12.12,()=>{confetti(540,380,90);spark(540,380,40,['#ffe14a','#ff4fd8','#3ff0ff']);sfx('boom');G.flash=.5;G.shake=34;pop(540,520,'JACKPOT!!','#ffe14a',true,-.05)}],[12.3,()=>koCall()]);
  return E}});
