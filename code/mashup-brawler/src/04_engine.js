// ================= engine: director, fixed-step clock, fx, HUD, replay, peel =================
const G={rt:0,ff:false,rec0:0,segs:[],si:0,ph:'fight',pt:0,lt:0,hit:0,shake:0,shx:0,shy:0,parts:[],pops:[],imp:[],big:[],fired:new Set(),
 combo:0,comboT:9,hpH:100,hpV:100,flash:0,done:false,qa:[],score:0,mBeat:0,dt:0,loopAll:false};
const WALK=1.7,LTS=1.22,RSPEED=.35,STEP=1/60;
const STD={hits:[[0,'slash'],[.35,'jab'],[.7,'slash'],[1.05,'upper'],[1.45,'slash'],[1.85,'jab'],[2.3,'slash'],[2.42,'jab'],[2.54,'slash'],[2.95,'upper']],counters:[3.55,4.1],r0:8.1,rN:24,rDt:.055,rEnd:9.5,fin:9.75};
function strikeIn(lt,list){let a=null,b=null;for(const h of list){const k=lt-h[0];if(k>=-.07&&k<.3){if(!a||h[0]>a.t)a={type:h[1],k,t:h[0]}}else if(k>=-.18&&k<-.07){if(!b)b={type:h[1],k,t:h[0]}}}return a||b}

// ---------- fx ----------
function spark(px,py,n,cols){for(let i=0;i<n;i++){const a=rnd()*TAU,v=220+rnd()*620;G.parts.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-180,l:.4+rnd()*.35,c:cols?cols[i%cols.length]:(rnd()<.5?'#fff6a8':'#ffffff'),s:7+rnd()*11,r:rnd()*6,k:rnd()<.3?1:0,g:1500})}}
function confetti(px,py,n){const C=['#ff4fd8','#3ff0ff','#ffd23a','#7cff6a','#ff6a3a','#ffffff'];for(let i=0;i<n;i++){const a=rnd()*TAU,v=300+rnd()*900;G.parts.push({x:px,y:py,vx:Math.cos(a)*v,vy:Math.sin(a)*v-300,l:1+rnd()*.8,c:C[i%6],s:10+rnd()*14,r:rnd()*6,k:2,g:900})}}
function pop(px,py,txt,col,big,rot){G.pops.push({x:px,y:py,t:0,txt,col:col||'#fff',big:!!big,rot:rot!=null?rot:(rnd()-.5)*.35})}
function impact(px,py,r){G.imp.push({x:px,y:py,t:0,r,rot:rnd()*6})}
function hit(px,py,o={}){const rep=G.ph==='replay';
 spark(px,py,o.cnt||(o.big?34:15),o.cols);impact(px,py,o.big?170:105);
 if(o.w)pop(px+(rnd()-.5)*50,py-120-rnd()*40,o.w,o.col||'#ffffff',o.big);
 G.hit=Math.max(G.hit,o.stop!=null?o.stop:(o.big?.16:.045));G.shake=Math.max(G.shake,o.shk||(o.big?28:13));
 sfx(o.snd||(o.big?'big':'hit'),o.vol||1);
 if(!rep)addCombo(o.n==null?1:o.n)}
function hurtHero(px,py,w){spark(px,py,18,['#ff7a7a','#ffffff','#ffd0d0']);impact(px,py,110);pop(px,py-130,w||'OOF!','#ff9a9a',false);G.hit=Math.max(G.hit,.08);G.shake=Math.max(G.shake,16);sfx('big',.8);if(G.ph!=='replay')G.hpH=Math.max(8,G.hpH-13)}
function addCombo(n){const old=G.combo;G.combo+=n;G.comboT=0;G.hpV=Math.max(4,G.hpV-n*1.7);for(const m of [10,25,50])if(old<m&&G.combo>=m)milestone(m)}
function milestone(m){G.hit=Math.max(G.hit,.33);G.big.push({k:'mile',t:0,txt:m+' HITS'+(m>=50?'!!':'!'),m});G.flash=Math.max(G.flash,.55);sfx('combo');G.shake=Math.max(G.shake,30)}
function banner(txt){if(G.ph==='replay')return;G.big.push({k:'banner',t:0,txt});sfx('banner');G.flash=Math.max(G.flash,.35)}
function koCall(){G.big.push({k:'ko',t:0,txt:'K.O.!'});sfx('ko');if(G.ph!=='replay')G.hpV=0}
// QA: every hero hit must land inside the target body
function contact(def,o,vdef,vo,label){const tip=tipW(def,o),hp=hitW(def,o),b=boxW(vdef,vo);const ok=inBox(tip,b,0)||inBox(hp,b,0);if(!G.ff&&G.ph!=='replay')G.qa.push([G.segs[G.si].L.id,label,+G.lt.toFixed(2),ok?'OK':'MISS',Math.round(tip[0]),Math.round(tip[1]),Math.round(b.x),Math.round(b.y),Math.round(b.rx),Math.round(b.ry)]);return hp}

// ---------- director ----------
let LEVELS=[];
function segsFromQuery(){const c=Q.get('clip'),l=Q.get('level');
 if(c&&+c>=1&&+c<=5){const n=+c;return[{L:LEVELS[n-1],next:LEVELS[n],stopAfter:true}]}
 if(c&&+c==6){const s=[];for(let i=0;i<5;i++)s.push({L:LEVELS[i],next:LEVELS[i+1],start:LEVELS[i].mS,end:LEVELS[i].mE,noReplay:true});s.push({L:LEVELS[5],stopAfter:true});return s}
 let st=0;if(l==='finale')st=5;else if(l&&+l>=1&&+l<=5)st=+l-1;
 G.loopAll=true;const s=[];for(let i=st;i<6;i++)s.push({L:LEVELS[i],next:LEVELS[i+1]||null});return s}
function startSeg(i){G.si=i;const sg=G.segs[i],L=sg.L;G.ph='fight';G.lt=0;G.pt=0;G.fired=new Set();G.parts=[];G.pops=[];G.imp=[];G.big=[];G.combo=0;G.comboT=9;G.hpH=100;G.hpV=100;G.hit=0;G.score=0;G.shake=0;seed(L.seed);
 if(sg.start){G.ff=true;while(G.lt<sg.start)stepLevel(STEP);G.ff=false;G.big=G.big.filter(b=>b.t<.3)}}
function fire(L){const E=L.ev;for(let i=0;i<E.length;i++){if(E[i][0]<=G.lt&&!G.fired.has(i)){G.fired.add(i);E[i][1](E[i][0])}}}
function startReplay(L){G.ph='replay';G.pt=0;G.lt=L.replayAt-.5;for(let i=0;i<L.ev.length;i++)if(L.ev[i][0]>=G.lt)G.fired.delete(i);G.parts=[];G.pops=[];G.imp=[];G.big=G.big.filter(b=>b.k==='ko');seed(L.seed+77);sfx('whoosh');}
function startWalk(){const sg=G.segs[G.si];if(!sg.end)G.lt=Math.max(G.lt,sg.L.endT);G.ph='walk';G.pt=0;G.big=[];G.crossed=false;if(!sg.next){endSeg();return}sfx('peel')}
function endSeg(){const sg=G.segs[G.si];if(sg.stopAfter||G.si>=G.segs.length-1){if(G.loopAll){G.segs=segsFromQuery0();startSeg(0);return}G.done=true;if(!CAP){setTimeout(()=>{G.done=false;startSeg(0)},1200)}return}startSeg(G.si+1)}
function segsFromQuery0(){G.loopAll=true;const s=[];for(let i=0;i<6;i++)s.push({L:LEVELS[i],next:LEVELS[i+1]||null});return s}
function stepLevel(dt){const sg=G.segs[G.si],L=sg.L;let d=dt;
 if(G.ph==='walk'){G.pt+=dt;G.lt+=dt;const pp=peelP();const hx=walkHeroX();if(!G.crossed&&peelX(GY-200)<hx){G.crossed=true;spark(hx,GY-200,26,['#ffffff','#fff6a8','#ff9de2','#9de8ff']);pop(hx,GY-470,'SWAP!','#9de8ff',true,-.1);sfx('star')}
  if(Math.floor((G.pt-dt)*4.2)!==Math.floor(G.pt*4.2))sfx('step');if(G.pt>=WALK){endSeg();return}}
 else{if(G.hit>0){G.hit-=dt;d=dt*.03}else d=dt*LTS;if(G.ph==='replay')d*=RSPEED/LTS;G.lt+=d;fire(L);
  if(G.ph==='fight'){const end=sg.end||L.endT;if(G.lt>=end){if(sg.noReplay||L.noReplay){if(L.final){endSeg();return}startWalk()}else startReplay(L)}}
  else if(G.ph==='replay'){G.pt+=dt;if(G.lt>=L.replayAt+.22)startWalk()}}
 const pd=G.ph==='walk'?dt:d;
 G.parts=G.parts.filter(p=>(p.l-=pd)>0);for(const p of G.parts){p.vy+=p.g*pd;p.x+=p.vx*pd;p.y+=p.vy*pd;if(p.k==2){p.vx*=Math.pow(.2,pd)}p.r+=pd*8}
 G.pops=G.pops.filter(p=>(p.t+=pd)<.85);G.imp=G.imp.filter(p=>(p.t+=pd)<.14);
 G.big=G.big.filter(b=>(b.t+=dt)<(b.k==='banner'?1.5:b.k==='ko'?9:.95));
 G.comboT+=pd;G.flash=Math.max(0,G.flash-dt*2.2);
 G.shake*=Math.pow(.015,dt);G.shx=(rnd()-.5)*G.shake;G.shy=(rnd()-.5)*G.shake;
 if(L.tick)L.tick(G.lt,pd)}
function music(dt){const sg=G.segs[G.si];if(!sg)return;const L=sg.L,bp=.2;const prev=G.mBeat;G.mBeat+=dt/bp;if(Math.floor(prev)===Math.floor(G.mBeat))return;const i=Math.floor(G.mBeat),b=i%16,R=L.root||110,v=G.ph==='replay'?.5:1;
 sfx('hat',v);if(b%4==0)sfx('kick',v);if(b%8==4)sfx('snare',v);if(b==14)sfx('snare',.6*v);
 const bl=[0,0,12,0,7,0,10,12,0,0,12,0,5,7,10,7];sfx('bass',v,R*Math.pow(2,bl[b]/12));
 const ld=L.lead||[12,-1,15,-1,19,-1,17,15,12,-1,10,-1,7,-1,10,-1];const bar=Math.floor(i/16)%2;if(ld[b]>=0&&(bar||b<8))sfx('lead',v,R*2*Math.pow(2,ld[b]/12))}
function step(dt){if(G.done)return;G.rt+=dt;music(dt);stepLevel(dt)}

// ---------- drawing fx ----------
function drawFx(){
 for(const p of G.imp){const k=p.t/.14;x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.globalAlpha=1-k*.6;const r=p.r*(.7+k*.6);
  x.fillStyle='#fff';x.strokeStyle=INK;x.lineWidth=7;x.beginPath();burst(0,0,9,r,r*.45);x.fill();x.stroke();x.fillStyle='#ffe14a';x.beginPath();burst(0,0,9,r*.62,r*.28,.2);x.fill();x.restore()}
 for(const p of G.parts){x.save();x.translate(p.x,p.y);x.rotate(p.r);x.globalAlpha=clamp(p.l*3);x.fillStyle=p.c;x.strokeStyle=INK;x.lineWidth=3;
  if(p.k==1){x.beginPath();star5(0,0,p.s,p.s*.45);x.fill();x.stroke()}else if(p.k==2){x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2)}else{x.beginPath();x.rect(-p.s/2,-p.s/2,p.s,p.s);x.fill();x.stroke()}x.restore()}
 for(const p of G.pops){const s=(p.big?1.55:1.05)*(1+Math.max(0,.12-p.t)*5);x.font=`900 62px ${FONT}`;const hw=Math.min(1000,x.measureText(p.txt).width*s+40)/2;const px=clamp(p.x,hw+10,W-hw-10);stext(p.txt,px,p.y-p.t*90,62,p.col,{rot:p.rot,sc:s,a:clamp((.85-p.t)*5),maxw:1000/s})}}
function rays(cx,cy,r,a,col='rgba(255,236,120,.55)'){x.save();x.translate(cx,cy);x.rotate(a);x.fillStyle=col;for(let i=0;i<16;i++){x.rotate(TAU/16);x.beginPath();x.moveTo(0,0);x.lineTo(r,-r*.09);x.lineTo(r,r*.09);x.fill()}x.restore()}
function drawBig(){for(const b of G.big){
 if(b.k==='mile'){const k=b.t,s=eback(clamp(k/.22)),a=clamp((.95-k)*6);x.save();x.globalAlpha=a;rays(540,560,900,k*1.5);x.restore();
  const col=b.m>=50?['#ff7ae0','#ff2a6a']:b.m>=25?['#fff27a','#ff9a1a']:['#ffffff','#9de8ff'];stext(b.txt,540,560,b.m>=50?165:150,'#fff',{rot:-.07,sc:s*1.05,a,grad:col,maxw:1000})}
 else if(b.k==='banner'){const k=b.t,inn=eout(clamp(k/.16)),out=ein(clamp((k-1.25)/.22)),dx=(1-inn)*-1200+out*1300;x.save();x.translate(540+dx,385);x.rotate(-.06);
  x.fillStyle='#fff';x.fillRect(-640,-112,1280,224);x.fillStyle=INK;x.fillRect(-640,-98,1280,196);x.fillStyle='#ff3a6a';x.fillRect(-640,-98,1280,26);x.fillStyle='#3ad0ff';x.fillRect(-640,72,1280,26);
  stext('FINISHER',-330,-128,44,'#ff3a6a',{rot:0});stext(b.txt,0,0,104,'#fff',{grad:['#fff9b0','#ffb21a'],maxw:1000,shadow:false});x.restore()}
 else if(b.k==='ko'){const k=b.t,s=eback(clamp(k/.25));x.save();x.globalAlpha=.6*clamp(k*4);rays(540,600,1000,k*.8,'rgba(255,255,255,.45)');x.restore();stext(b.txt,540,600,230,'#fff',{rot:-.08,sc:s,grad:['#ffe96a','#ff6a1a']})}}}
function bar(bx,by,w,v,col,right){x.fillStyle='#fff';x.fillRect(bx-8,by-8,w+16,44);x.fillStyle=INK;x.fillRect(bx-3,by-3,w+6,34);x.fillStyle='#4a3b5c';x.fillRect(bx,by,w,28);const ww=w*clamp(v/100);x.fillStyle=col;x.fillRect(right?bx+w-ww:bx,by,ww,28);x.fillStyle='rgba(255,255,255,.45)';x.fillRect(right?bx+w-ww:bx,by+3,ww,7)}
function hud(L,co){if(!co){
 stext(L.title,540,62,40,'#fff',{grad:['#ffffff','#ffe27a'],maxw:1000});
 stext(L.hn,40,130,40,'#fff',{align:'left',grad:['#ffffff','#9de8ff']});stext(L.vn,1040,130,40,'#fff',{align:'right',grad:['#ffffff','#ffb0b0']});
 bar(40,168,450,G.hpH,'#45e05a');bar(590,168,450,G.hpV,'#ff4d5a',1);
 stext(L.hsub,40,236,24,'#fff',{align:'left'});stext(L.vsub||'',1040,236,24,'#fff',{align:'right'});}
 if(G.combo>=2){const pulse=1+Math.max(0,.15-G.comboT)*3,c=G.combo,col=c>=50?['#ff9af0','#ff2a6a']:c>=25?['#fff27a','#ff8a1a']:c>=10?['#ffffff','#7ae0ff']:['#ffffff','#d0d0ff'];
  const cy=L.comboY||1640,cs=L.comboY?.62:1;x.save();x.translate(540,cy);x.scale(cs,cs);stext(String(c),-70,0,200,'#fff',{align:'right',sc:pulse,grad:col,rot:-.05});stext('HITS',-40,20,96,'#fff',{align:'left',grad:col,rot:-.05});stext('COMBO',0,-110,40,'#fff',{rot:-.05});x.restore()}
 x.globalAlpha=.55;x.font=`900 22px ${FONT}`;x.fillStyle='#fff';x.textAlign='center';x.fillText('MASHUP BRAWLER · private fan prototype',540,1890);x.globalAlpha=1}
function replayOverlay(){const k=G.pt;x.fillStyle='#000';x.fillRect(0,0,W,190);x.fillRect(0,H-190,W,190);
 if(Math.floor(k*3)%2==0){x.fillStyle='#ff2a3a';x.beginPath();x.arc(80,95,22,0,TAU);x.fill()}
 stext('REPLAY',130,98,64,'#fff',{align:'left',shadow:false});stext('SLOW-MO  ×0.35',1040,98,38,'#fff',{align:'right',shadow:false,grad:['#fff','#9de8ff']});
 stext('FINAL BLOW',540,H-95,52,'#fff',{shadow:false,grad:['#fff9b0','#ffb21a']})}

// ---------- peel transition ----------
function peelP(){return ease(seg(G.pt,.15,WALK-.12))}
function peelX(y){const p=peelP();return lerp(W+560,-560,p)+(y-H/2)*.28}
function walkHeroX(){const sg=G.segs[G.si];return lerp(sg.L.hx,sg.next?sg.next.hx:sg.L.hx,ease(seg(G.pt,0,WALK)))}
function jag(i){return(hs(i*1.7+3)-.5)*34}
function peelPath(side){const N=34;x.beginPath();for(let i=0;i<=N;i++){const y=-60+i*(H+120)/N,xx=peelX(y)+jag(i);i?x.lineTo(xx,y):x.moveTo(xx,y)}if(side>0){x.lineTo(W+900,H+60);x.lineTo(W+900,-60)}else{x.lineTo(-900,H+60);x.lineTo(-900,-60)}x.closePath()}
function drawWalk(){const sg=G.segs[G.si],L=sg.L,N=sg.next,cam=G.pt*520,camB=(G.pt-WALK)*520;
 withCtx(OFF[0],()=>{L.draw(G.lt,{noHero:true,cam});drawFx()});
 withCtx(OFF[1],()=>{N.draw(-1,{noHero:true,cam:camB,preview:true});titleCard(N)});
 x.save();x.setTransform(1,0,0,1,0,0);x.drawImage(OFF[0],0,0);x.restore();
 x.save();peelPath(1);x.clip();x.setTransform(1,0,0,1,0,0);x.drawImage(OFF[1],0,0);x.restore();
 // shadow cast on the new world just right of the tear
 x.save();peelPath(1);x.clip();const nx=Math.cos(.27),ny=-Math.sin(.27);const mx=peelX(H/2);const g=x.createLinearGradient(mx,H/2,mx+70*nx,H/2+70*ny);g.addColorStop(0,'rgba(20,8,40,.45)');g.addColorStop(1,'rgba(20,8,40,0)');x.fillStyle=g;x.fillRect(-200,-100,W+400,H+200);x.restore();
 // curled flap (sticker backing) to the left of the tear
 const fw=Math.min(240,(W+560-peelX(H/2))*.32);const N2=34;const pts=[];for(let i=0;i<=N2;i++){const y=-60+i*(H+120)/N2;pts.push([peelX(y)+jag(i),y])}
 x.save();x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));for(let i=N2;i>=0;i--){const p=pts[i];const w=fw*(.85+.15*Math.sin(i*.5));x.lineTo(p[0]-w*Math.cos(.27)+jag(i+50)*.3,p[1]+w*Math.sin(.27)*.0)}x.closePath();
 x.shadowColor='rgba(20,8,40,.5)';x.shadowBlur=40;x.shadowOffsetX=-24;const gg=x.createLinearGradient(mx,0,mx-fw,0);gg.addColorStop(0,'#ffffff');gg.addColorStop(.55,'#efeaf6');gg.addColorStop(1,'#c9c0da');x.fillStyle=gg;x.fill();x.shadowColor='transparent';x.lineWidth=6;x.strokeStyle=INK;x.stroke();
 x.globalAlpha=.25;x.strokeStyle='#9a8fb5';x.lineWidth=3;for(let k=1;k<4;k++){x.beginPath();pts.forEach((p,i)=>{const xx=p[0]-fw*k/4;i?x.lineTo(xx,p[1]):x.moveTo(xx,p[1])});x.stroke()}x.restore();
 // the walking hero: swaps mid-stride when the tear passes him
 const hx=walkHeroX(),newSide=peelX(GY-200)<hx;const HL=newSide?N:L;const o=HL.walkPose(G.pt*11);o.x=hx;HL.drawHero(o);
 x.save();x.translate(G.shx*.3,G.shy*.3);drawFx();x.restore()}
function titleCard(N){stext(N.wtag,540,440,64,'#fff',{rot:-.05,grad:['#ffffff','#9de8ff']});stext(N.name,540,560,118,'#fff',{rot:-.05,maxw:980,grad:['#fff9b0','#ffb21a']});stext(N.vs,540,690,50,'#fff',{rot:-.05,maxw:980})}

// ---------- frame ----------
function render(){const sg=G.segs[G.si];if(!sg)return;const L=sg.L;x.setTransform(BASE,0,0,BASE,0,0);
 if(G.ph==='walk'&&sg.next){drawWalk();x.setTransform(BASE,0,0,BASE,0,0)}
 else{x.save();x.translate(G.shx,G.shy);L.draw(G.lt,{cam:0});drawFx();x.restore();if(G.ph==='replay'){drawBig();replayOverlay()}else{if(!(L.hideAll&&G.lt>=L.hideAll))hud(L,L.noHud&&G.lt>=L.noHud);drawBig()}}
 if(L.over)L.over(G.lt);
 if(G.flash>0){x.fillStyle=`rgba(255,255,255,${G.flash})`;x.fillRect(0,0,W,H)}}
