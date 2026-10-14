// ================= level framework =================
const restA=lt=>[REST[0]+Math.sin(lt*4)*.05,REST[1],REST[2]];
const VICT=[2.75,.25,-.45];
function H0(L,lt){return{x:L.hx,y:GY,face:1,wpn:L.wpn,t:lt,A:restA(lt)}}
function V0(L,lt){return{x:L.vx,y:L.vy||GY,face:-1,t:lt,wpn:L.vw||'claw',A:restA(lt+1)}}
function react(v,lt,times,push=26){let best=null;for(const t of times){const k=lt-t;if(k>=0&&k<.26&&(best==null||k<best))best=k}
 if(best!=null){const u=1-best/.26;v.hurt=Math.max(v.hurt||0,u);v.flash=best<.05?1:0;v.x-=(v.face||-1)*push*u;v.lean=-.12*u}return v}
function rushTimes(){const a=[];for(let i=0;i<STD.rN;i++)a.push(STD.r0+i*STD.rDt);return a}
function stdPose(L,lt){const h=H0(L,lt),v=V0(L,lt);const st=strikeIn(lt,L.hits);
 if(lt>=STD.r0-.05&&lt<STD.r0+STD.rN*STD.rDt){const q=Math.max(0,(lt-STD.r0)/STD.rDt),i=Math.floor(q),u=q-i;const imp=i%2?[1.85,-.2,-.45]:[1.6,0,-.15],pull=[1.15,.45,-.6];const w=Math.sin(u*Math.PI);
  h.A=imp.map((a,j)=>lerp(a,pull[j],w));h.x+=L.lunge*.8;h.lean=.08;h.rush=1;v.x+=Math.sin(lt*95)*7}
 else if(st){h.A=kfA(st.type,st.k);h.atk=st;const lg=clamp(1-Math.abs(st.k)/.16);h.x+=lg*L.lunge;h.lean=lg*.1}
 react(v,lt,L.vHit);
 for(const ct of STD.counters){const k=lt-ct;if(k>-.3&&k<.3){v.atk={type:L.vAtk||'low',k};v.A=kfA(v.atk.type,k);const lg=clamp(1-Math.abs(k)/.22);v.x-=lg*L.vLunge;v.lean=lg*.1;v.hurt=0;v.flash=0}
  if(k>=0&&k<.42){const u=1-k/.42;h.hurt=u;h.x-=u*60;h.lean=-.16*u;h.A=[.2,1.6,-1.3];h.atk=null}}
 return{h,v}}
function footW(def,o,hip,l1,l2,ext){const [a1,a2]=legAng(o,1);const ex=hip[0]+Math.sin(a1)*l1,ey=hip[1]+Math.cos(a1)*l1,fx=ex+Math.sin(a1+a2)*l2,fy=ey+Math.cos(a1+a2)*l2,d=a1+a2;return toW(def,o,fx+Math.sin(d)*ext,fy+Math.cos(d)*ext)}
function stdEvents(L){const E=[];
 L.hits.forEach(([t,ty],i)=>E.push([t,()=>{const S=L.pose(t);const p=contact(L.hero,S.h,L.vil,S.v,'hit@'+t);const big=t===STD.rEnd;hit(p[0],p[1],{w:big?L.wEnd:L.words[i%L.words.length],big,n:1})}]));
 rushTimes().forEach((t,i)=>E.push([t,()=>{const S=L.pose(t);const p=contact(L.hero,S.h,L.vil,S.v,'rush'+i);hit(p[0],p[1],{w:i%8==3?L.wRush:null,n:1,stop:.012,cnt:6,snd:'rush',shk:9})}]));
 STD.counters.forEach(t=>E.push([t,()=>{const S=L.pose(t);const p=L.vTip?L.vTip(S):contact(L.vil,S.v,L.hero,S.h,'counter@'+t);hurtHero(p[0],p[1],L.cWord||'OOF!')}]));
 return E}
function rushFx(def,o,lt){const p=hitW(def,o,.9);x.save();x.translate(p[0],p[1]);x.strokeStyle='#fff';x.lineCap='round';for(let i=0;i<6;i++){const a=hs(Math.floor(lt*40)+i)*TAU,r1=60,r2=150+hs(i+Math.floor(lt*40))*80;x.lineWidth=10;x.globalAlpha=.85;x.beginPath();x.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);x.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);x.stroke()}x.restore()}
function mkLevel(c){const tm=c.tmap||{};const L=Object.assign({lunge:40,vLunge:90,hits:STD.hits.concat(c.extraHits||[]).concat([[STD.rEnd,'upper']]).map(h=>[h[0],tm[h[1]]||h[1]]),noReplay:false,
 drawHero(o){drawChar(this.hero,o)},
 walkPose(w){return{x:0,y:GY,face:1,wpn:this.wpn,walk:w+.01,t:w,A:[.3,2.4,-.6]}},
 draw(lt,opt){const cam=opt.cam||0;this.bg(cam,lt,this);const S=this.pose(lt);S.lt=lt;if(this.back)this.back(lt,S,cam,opt);
  const list=this.actors?this.actors(lt,S):[[this.vil,S.v],[this.hero,S.h,1]];
  for(const it of list){const [d,o,isH]=it;if(isH&&opt.noHero)continue;drawChar(d,o);if(isH&&o.atk&&!o.rush&&!opt.noHero)smear(d,o,o.atk.k);if(isH&&o.rush)rushFx(d,o,lt)}
  if(this.front)this.front(lt,S,cam,opt)}},c);
 L.vHit=L.hits.map(h=>h[0]).concat(rushTimes()).concat(c.extraVHit||[]);
 L.ev=stdEvents(L).concat(c.events?c.events(L):[]).sort((a,b)=>a[0]-b[0]);return L}
// path helper: piecewise linear through [t,x,y] keys with optional hop
function path(keys,t,hop=0){if(t<=keys[0][0])return[keys[0][1],keys[0][2]];for(let i=1;i<keys.length;i++){if(t<=keys[i][0]){const a=keys[i-1],b=keys[i],u=seg(t,a[0],b[0]);return[lerp(a[1],b[1],u),lerp(a[2],b[2],u)-Math.sin(u*Math.PI)*hop]}}const k=keys[keys.length-1];return[k[1],k[2]]}
