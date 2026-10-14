// ================= FINALE: 5 heroes vs 5 villains, weapon tosses, ULTIMATE MASHUP chain-launch, logo =================
const LN=[{L:L5,y:720,sc:.56,cx:470},{L:L4,y:965,sc:.6,cx:610,vil:MRX,vw:'none'},{L:L3,y:1210,sc:.66,cx:470},{L:L2,y:1460,sc:.72,cx:610},{L:L1,y:1735,sc:.8,cx:500}];
LN.forEach((n,l)=>{n.hero=n.L.hero;n.vil=n.vil||n.L.vil;n.d=(n.L.vx-n.L.hx)*n.sc;n.hx=n.cx-n.d/2;n.vx=n.cx+n.d/2;
 const tm=n.L.tmap||{};n.hits=[];for(let j=0;j<10;j++){const t=l*.08+j*.47;if(t<4.25)n.hits.push([t,tm[['slash','jab','upper'][(j+l)%3]]||['slash','jab','upper'][(j+l)%3]])}
 n.rush=[];for(let j=0;j<10;j++)n.rush.push([5.75+l*.026+j*.13,j%2?'slash':'jab']);n.fin=[7.3+l*.05,tm.upper||'upper'];n.ctr=4.5+l*.05});
// weapon tosses: [t0,t1,laneA,laneB]
const TOSS=[[1.75,2.3,4,0],[3.0,3.55,1,2],[5.0,5.55,3,4]];
LN.forEach((n,l)=>{n.hits=n.hits.filter(h=>!TOSS.some(T=>(T[2]==l||T[3]==l)&&h[0]>T[0]-.25&&h[0]<T[1]+.15));n.all=n.hits.concat(n.rush).concat([n.fin]);n.vHit=n.all.map(h=>h[0])});
function wpnAt(l,ft){let w=LN[l].L.wpn;const own=[...LN.map(n=>n.L.wpn)];const cur=own.slice();for(const T of TOSS){if(ft>=T[1]){const a=cur[T[2]];cur[T[2]]=cur[T[3]];cur[T[3]]=a}else if(ft>=T[0]&&(T[2]==l||T[3]==l))return 'none'}return cur[l]}
function heldBefore(l,T){const cur=LN.map(n=>n.L.wpn);for(const U of TOSS){if(U===T)break;const a=cur[U[2]];cur[U[2]]=cur[U[3]];cur[U[3]]=a}return cur[l]}
const CHAIN=[[0,8.45,'upper'],[1,9.07,'upper'],[2,9.69,'slash'],[3,10.31,'slash'],[4,10.93,'upper']];
const PANH=[SONIC,MARIO,DK,KIRBY,SAMUS],PANL=[L1,L2,L3,L4,L5],LOGO_T=11.7;
function flyWeapon(w,X,Y,ang,s){x.save();x.translate(X,Y);x.scale(s,s);sticker(()=>weapon(w,{wpn:w,nlag:1.2},{hx:0,hy:0,wd:ang}));x.restore()}
const FIN={id:6,seed:606,final:true,noReplay:true,wtag:'FINALE',name:'ALL-STAR MASHUP',title:'FINALE · ALL-STAR MASHUP',vs:'5 HEROES  vs  5 VILLAINS',
 hn:'HEROES',hsub:'WEAPONS SWAP MID-FIGHT!',vn:'VILLAINS',vsub:'ALL 5 BOSSES',hx:LN[4].hx,root:110,comboY:340,endT:15.0,noHud:8.2,hideAll:11.7,
 lead:[12,-1,12,15,-1,17,19,-1,22,-1,19,17,15,-1,12,-1],
 walkPose(w){return{x:0,y:GY,face:1,wpn:'master',walk:w+.01,t:w,A:[.3,2.4,-.6],sc:.85}},
 drawHero(o){drawChar(SONIC,o)},
 lane(l,ft){const n=LN[l],L=n.L;const h={x:n.hx,y:n.y,gy:n.y,face:1,wpn:wpnAt(l,ft),t:ft+l,A:restA(ft+l),sc:n.sc},v={x:n.vx,y:n.y,gy:n.y,face:-1,t:ft+l*.7,wpn:n.vw||L.vw||'claw',A:restA(ft+l+1),sc:n.sc};
  if(L===L5&&ft>0)v.super=1;
  const st=strikeIn(ft,n.all);if(st){h.A=kfA(st.type,st.k);h.atk=st;const lg=clamp(1-Math.abs(st.k)/.16);h.x+=lg*(L.lunge+(h.wpn==='fists'&&L!==L2?60:0))*n.sc;h.lean=lg*.1}
  react(v,ft,n.vHit,26*n.sc);
  const k=ft-n.ctr;if(k>-.3&&k<.3){v.atk={type:L.vAtk||'low',k};v.A=kfA(v.atk.type,k);const lg=clamp(1-Math.abs(k)/.22);v.x-=lg*L.vLunge*n.sc;v.lean=lg*.1;v.hurt=0;v.flash=0;if(l==1){v.sy=1-.3*lg;v.A=[v.A[0]-.5*lg,v.A[1],v.A[2]]}if(L===L3)v.punch=k<0?seg(k,-.15,0):k<.12?1:1-seg(k,.12,.3)}
  if(k>=0&&k<.42){const u=1-k/.42;h.hurt=u;h.x-=u*60*n.sc;h.lean=-.16*u;h.A=[.2,1.6,-1.3];h.atk=null}
  for(const T of TOSS){if(T[2]==l||T[3]==l){if(ft>=T[0]-.2&&ft<T[0]+.1)h.A=[lerp(1,2.9,seg(ft,T[0]-.2,T[0])),.2,-.5];else if(ft>=T[1]-.1&&ft<T[1]+.15)h.A=[2.7,.2,-.4]}}
  if(h.wpn==='nunch')h.nlag=nunLag(h);
  if(L===L3){v.y-=110*n.sc-Math.sin(ft*3)*10}
  const ko=n.fin[0];if(l<4&&ft>=ko){const u=seg(ft,ko,ko+.7);v.x+=u*900;v.y-=Math.sin(u*Math.PI*.8)*700+u*200;v.rot=u*12;v.hurt=1;v.shadow=false;if(ft>ko+.7)v.hide=1}
  if(l==4&&ft>=ko){v.hurt=1;v.x+=Math.sin(ft*20)*5}
  if(ft>ko+.3)h.A=VICT;
  return{h,v}},
 pose(ft){return{lanes:LN.map((_,l)=>this.lane(l,ft))}},
 // ---- panorama chain-launch ----
 panHero(i,ft){const o={x:i*W+330,y:GY,face:1,wpn:PANL[i].wpn,t:ft+i,A:restA(ft+i)};const c=CHAIN[i];const st=strikeIn(ft,[[c[1],c[2]]]);if(st){o.A=kfA(st.type,st.k);o.atk=st;o.x+=clamp(1-Math.abs(st.k)/.16)*PANL[i].lunge}else if(ft>c[1])o.A=VICT;if(o.wpn==='nunch')o.nlag=nunLag(o);return o},
 hp(i){return hitW(PANH[i],this.panHero(i,CHAIN[i][1]))},
 bowserC(ft){if(ft<CHAIN[0][1])return[L1.vx-9,GY-258];for(let i=1;i<5;i++){if(ft<CHAIN[i][1]){const a=i==1?[L1.vx-9,GY-258]:this.hp(i-1),b=this.hp(i),u=seg(ft,CHAIN[i-1][1],CHAIN[i][1]);return[lerp(a[0],b[0],u),lerp(a[1],b[1],u)-Math.sin(u*Math.PI)*280]}}
  const a=this.hp(4),cam=4*W,u=seg(ft,CHAIN[4][1],LOGO_T);return[lerp(a[0],cam+540,ease(u)),lerp(a[1],760,ease(u))]},
 camX(ft){const c=this.bowserC(ft)[0];return clamp(c-600,0,4*W)},
 drawPan(ft){const cam=this.camX(ft);
  for(let i=0;i<5;i++){const off=i*W-cam;if(off>W||off<-W)continue;x.save();x.translate(off,0);x.beginPath();x.rect(0,0,W,H);x.clip();BGS[i](0,ft,PANL[i]);
   const o=this.panHero(i,ft);o.x-=i*W;drawChar(PANH[i],o);if(o.atk)smear(PANH[i],o,o.atk.k);
   if(ft<LOGO_T-.02)stext(PANL[i].name,540,520,64,'#fff',{rot:-.05,maxw:900,grad:['#fff9b0','#ffb21a']});x.restore();
   if(i>0){const sx=off;x.save();x.fillStyle='#fff';x.strokeStyle=INK;x.lineWidth=6;x.beginPath();for(let k=0;k<=30;k++){const y=-40+k*(H+80)/30;x.lineTo(sx+jag(k+i*40)*1.2-14,y)}for(let k=30;k>=0;k--){const y=-40+k*(H+80)/30;x.lineTo(sx+jag(k+i*40+9)*1.2+14,y)}x.closePath();x.fill();x.stroke();x.restore()}}
  const c=this.bowserC(ft);let sc=.8;if(ft>CHAIN[4][1])sc=lerp(.8,3.0,ein(seg(ft,CHAIN[4][1],LOGO_T)));
  if(ft<LOGO_T-.02){}const o={hide:ft>=LOGO_T-.02,x:c[0]-cam,y:c[1]+112*2.3*sc,face:-1,t:ft,hurt:ft>CHAIN[0][1]?1:0,sc,rot:ft>CHAIN[0][1]?ft*9:0,shadow:false,wpn:'claw',A:restA(ft)};if(ft<CHAIN[0][1])o.y=GY;drawChar(BOWSER,o);
  if(ft>CHAIN[0][1]&&ft<LOGO_T){x.save();x.strokeStyle='rgba(255,255,255,.7)';x.lineCap='round';for(let k=0;k<8;k++){const yy=c[1]+(hs(k)-.5)*300;x.lineWidth=12;x.beginPath();x.moveTo(c[0]-cam-200-hs(k+3)*200,yy);x.lineTo(c[0]-cam-420-hs(k+5)*300,yy);x.stroke()}x.restore()}},
 collage(ft){for(let i=0;i<5;i++){x.save();x.beginPath();const a=i*216-40,b=(i+1)*216+40;x.moveTo(a+120,0);x.lineTo(b+120,0);x.lineTo(b-120,H);x.lineTo(a-120,H);x.closePath();x.clip();BGS[i](i*260,ft,PANL[i]);x.fillStyle='rgba(18,8,40,.25)';x.fillRect(0,0,W,H);x.restore();
   if(i){x.save();x.strokeStyle='#fff';x.lineWidth=16;x.beginPath();x.moveTo(a+40+120,0);x.lineTo(a+40-120,H);x.stroke();x.strokeStyle=INK;x.lineWidth=5;x.stroke();x.restore()}}
  },
 draw(ft,opt){if(ft>=8.2){this.drawPan(Math.min(ft,LOGO_T));return}
  this.collage(ft);const S=this.pose(ft);
  for(let l=0;l<5;l++){const {h,v}=S.lanes[l],n=LN[l];x.save();x.globalAlpha=.3;x.fillStyle='#000';x.beginPath();x.ellipse(n.cx,n.y+6,n.d*.75,16*n.sc,0,0,TAU);x.fill();x.restore();
   drawChar(n.vil,Object.assign(v,{shadow:false}));if(!(opt.noHero&&l==4)){drawChar(n.hero,Object.assign(h,{shadow:false}));if(h.atk)smear(n.hero,h,h.atk.k)}}
  for(const T of TOSS){if(ft>=T[0]&&ft<T[1]){const u=seg(ft,T[0],T[1]);for(const [fa,fb] of [[T[2],T[3]],[T[3],T[2]]]){const A=S.lanes[fa].h,B=S.lanes[fb].h;const pa=toW(LN[fa].hero,A,10,-150),pb=toW(LN[fb].hero,B,10,-150);
     const w=heldBefore(fa,T);flyWeapon(w,lerp(pa[0],pb[0],u),lerp(pa[1],pb[1],u)-Math.sin(u*Math.PI)*380,u*14,1.7)}}}},
 over(ft){if(ft>=8.2&&ft<LOGO_T){stext('ULTIMATE MASHUP',540,1450,64,'#fff',{rot:-.04,grad:['#ff9af0','#ff2a6a']})}
  if(ft>=LOGO_T){const k=G.lt-LOGO_T;x.fillStyle='rgba(14,6,34,.55)';x.fillRect(0,0,W,H);x.save();rays(540,800,1100,k*.6,'rgba(255,230,120,.35)');x.restore();
   for(let i=0;i<5;i++){const o={x:150+i*195,y:1620,face:1,wpn:PANL[i].wpn,t:k*3+i,A:VICT,sc:.62+(i==2?.0:0),shadow:false};o.y-=Math.abs(Math.sin(k*5+i))*24;if(o.wpn==='nunch')o.nlag=2;drawChar(PANH[i],o)}
   const s=eback(clamp(k/.35));x.save();x.translate(540,800);x.rotate(-.06);x.scale(s,s);
   LW=2.2;sticker(()=>{rr(-500,-250,1000,500,60,'#2a0a4a')});LW=1;x.fillStyle='#ff3a6a';x.fillRect(-470,-215,940,22);x.fillStyle='#3ad0ff';x.fillRect(-470,193,940,22);
   for(let i=0;i<30;i++){x.fillStyle=(i+Math.floor(k*8))%2?'#ffe14a':'#ff4fd8';x.beginPath();x.arc(-450+i*31,-232,7,0,TAU);x.arc(-450+i*31,232,7,0,TAU);x.fill()}
   stext('MASHUP',0,-82,200,'#fff',{grad:['#fff9b0','#ffb21a'],maxw:900});stext('BRAWLER',0,105,190,'#fff',{grad:['#9de8ff','#3a7aff'],maxw:900});x.restore();
   stext('ALL 5 WORLDS CLEARED!',540,1180,56,'#fff',{a:clamp((k-.4)*4),rot:-.04,grad:['#ffffff','#ffe27a']});
   if(G.combo>=2)stext('MAX COMBO  '+G.combo,540,1300,52,'#fff',{a:clamp((k-.6)*4),rot:-.04,grad:['#ff9af0','#ff2a6a']})}},
 events(){const E=[];LN.forEach((n,l)=>{n.all.forEach(([t],j)=>E.push([t,()=>{const S=FIN.lane(l,t);const p=contact(n.hero,S.h,n.vil,S.v,'lane'+l+'@'+t.toFixed(2));const isFin=t===n.fin[0],isR=t>=5.7&&!isFin;
   hit(p[0],p[1],{w:isFin?'K.O.!':isR?((j+l)%8==0?'RUSH!':null):((j+l)%2?null:PANL[l].words[j%5]),big:isFin,n:1,stop:isR?.01:isFin?.08:.03,cnt:isR?6:12,vol:.75})}]));
  E.push([n.ctr,()=>{const S=FIN.lane(l,n.ctr);const p=n.L===L3?toW(EGG,S.v,60+70*(S.v.punch||1)+14,-62):contact(n.vil,S.v,n.hero,S.h,'fctr'+l);hurtHero(p[0],p[1],l==4?'GRR!':'OOF!')}])});
  TOSS.forEach(T=>{E.push([T[0],()=>{sfx('whoosh');pop(540,700,'WEAPON SWAP!','#9de8ff',true,-.05)}],[T[1],()=>{sfx('ding');const S=FIN.pose(T[1]);[T[2],T[3]].forEach(l=>{const p=toW(LN[l].hero,S.lanes[l].h,10,-150);spark(p[0],p[1],14,['#fff','#9de8ff']);pop(p[0],p[1]-80,'CATCH!','#ffe14a',false)})}])});
  E.push([7.9,()=>banner('ULTIMATE MASHUP!')],[8.2,()=>{G.flash=.9;sfx('big')}]);
  CHAIN.forEach(([i,t])=>E.push([t,()=>{const p=FIN.hp(i);const cam=FIN.camX(t);hit(p[0]-cam,p[1],{w:['SONIC!','MARIO!','DK!','KIRBY!','SAMUS!'][i],big:true,n:5,stop:.1})}]));
  E.push([LOGO_T-.05,()=>{G.flash=1;sfx('boom')}],[LOGO_T,()=>{sfx('ko');sfx('combo')}],[LOGO_T+.4,()=>sfx('star')]);
  return E.sort((a,b)=>a[0]-b[0])}};
FIN.ev=FIN.events();
