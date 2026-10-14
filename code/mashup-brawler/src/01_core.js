'use strict';
// ================= MASHUP BRAWLER — core =================
const CV=document.getElementById('c');let x=CV.getContext('2d');
const W=1080,H=1920,INK='#1a1026',GY=1380,TAU=Math.PI*2;
const Q=new URLSearchParams(location.search);
const CAP=Q.has('capture');
const OFF=[document.createElement('canvas'),document.createElement('canvas')];
let BASE=1;
function rs(){
 if(CAP){CV.width=W;CV.height=H;BASE=1;CV.style.width=W+'px';CV.style.height=H+'px';}
 else{const r=Math.min(window.devicePixelRatio||1,2),a=innerWidth,b=innerHeight,s=Math.min(a/W,b/H);
  CV.width=Math.round(W*s*r);CV.height=Math.round(H*s*r);CV.style.width=(W*s)+'px';CV.style.height=(H*s)+'px';CV.style.marginTop=((b-H*s)/2)+'px';BASE=s*r;}
 OFF.forEach(o=>{o.width=CV.width;o.height=CV.height});
}
rs();addEventListener('resize',rs);

// ---------- math ----------
const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, seg=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>t*t*(3-2*t), eout=t=>1-(1-t)*(1-t), ein=t=>t*t, eback=t=>{const c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const hs=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
let rngS=1;function rnd(){rngS=rngS+0x6D2B79F5|0;let t=Math.imul(rngS^rngS>>>15,1|rngS);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
function seed(s){rngS=s|0}

// ---------- sticker drawing helpers (pass 0 = white sticker outline, pass 1 = colour + ink) ----------
let P=1,LW=1,FL=0;const LITE={};function lite(c){if(typeof c!=='string'||c[0]!=='#'||c.length!==7)return c;if(!LITE[c]){const n=parseInt(c.slice(1),16),m=v=>Math.round(v+(255-v)*.72);LITE[c]='rgb('+m(n>>16)+','+m((n>>8)&255)+','+m(n&255)+')'}return LITE[c]}
function sh(fill,fn){x.beginPath();fn();
 if(P==0){x.strokeStyle='#fff';x.lineWidth=13*LW;x.lineJoin='round';x.lineCap='round';x.stroke();x.fillStyle='#fff';x.fill()}
 else{if(fill){x.fillStyle=FL?lite(fill):fill;x.fill()}x.strokeStyle=INK;x.lineWidth=3.6*LW;x.lineJoin='round';x.lineCap='round';x.stroke()}}
function cap(x1,y1,x2,y2,r,f){sh(f,()=>{const a=Math.atan2(y2-y1,x2-x1);x.arc(x1,y1,r,a+Math.PI/2,a-Math.PI/2);x.arc(x2,y2,r,a-Math.PI/2,a+Math.PI/2);x.closePath()})}
function ell(cx,cy,rx,ry,f,rot=0){sh(f,()=>x.ellipse(cx,cy,Math.abs(rx),Math.abs(ry),rot,0,TAU))}
function circ(cx,cy,r,f){sh(f,()=>x.arc(cx,cy,Math.abs(r),0,TAU))}
function poly(p,f){sh(f,()=>{x.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)x.lineTo(p[i],p[i+1]);x.closePath()})}
function rr(X,Y,w,h,r,f){sh(f,()=>{x.roundRect?x.roundRect(X,Y,w,h,r):x.rect(X,Y,w,h)})}
function limb(px,py,a1,a2,l1,l2,r,f){const ex=px+Math.sin(a1)*l1,ey=py+Math.cos(a1)*l1,hx=ex+Math.sin(a1+a2)*l2,hy=ey+Math.cos(a1+a2)*l2;cap(px,py,ex,ey,r,f);cap(ex,ey,hx,hy,r*.9,f);return[hx,hy]}
function ln(fn,col,w){x.beginPath();fn();x.lineCap='round';x.lineJoin='round';if(P==0){x.strokeStyle='#fff';x.lineWidth=w+10*LW;x.stroke()}else{x.strokeStyle=INK;x.lineWidth=w+3.6*LW;x.stroke();x.strokeStyle=FL?lite(col):col;x.lineWidth=w;x.stroke()}}
function inkLine(fn,w=3){if(!P)return;x.beginPath();fn();x.strokeStyle=INK;x.lineWidth=w;x.lineCap='round';x.lineJoin='round';x.stroke()}
function dot(cx,cy,r,col){if(!P)return;x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill()}
function star5(cx,cy,r1,r2,rot=0){for(let i=0;i<10;i++){const a=rot-Math.PI/2+i*Math.PI/5,r=i%2?r2:r1;i?x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):x.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}x.closePath()}
function burst(cx,cy,n,r1,r2,rot=0){for(let i=0;i<n*2;i++){const a=rot+i*Math.PI/n,r=i%2?r2:r1*(0.85+hs(i*3.1)*0.3);i?x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):x.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r)}x.closePath()}
function sticker(fn){for(P=0;P<2;P++){x.save();fn();x.restore()}P=1}
const FONT='"Arial Black","Impact","Nimbus Sans","Helvetica Neue",Arial,sans-serif';
function stext(txt,X,Y,size,fill,o={}){x.save();x.translate(X,Y);x.rotate(o.rot||0);const s=o.sc==null?1:o.sc;x.scale(s,s);x.globalAlpha*=(o.a==null?1:o.a);
 x.font=`900 ${size}px ${FONT}`;x.textAlign=o.align||'center';x.textBaseline='middle';x.lineJoin='round';
 if(o.maxw){const m=x.measureText(txt).width;if(m>o.maxw){const k=o.maxw/m;x.scale(k,k)}}
 if(o.shadow!==false){x.fillStyle='rgba(20,8,40,.45)';x.lineWidth=size*.36;x.strokeStyle='rgba(20,8,40,.45)';x.strokeText(txt,size*.06,size*.1)}
 x.lineWidth=size*.34;x.strokeStyle=o.outline||'#fff';x.strokeText(txt,0,0);x.lineWidth=size*.13;x.strokeStyle=o.ink||INK;x.strokeText(txt,0,0);
 if(o.grad){const g=x.createLinearGradient(0,-size*.5,0,size*.5);g.addColorStop(0,o.grad[0]);g.addColorStop(1,o.grad[1]);x.fillStyle=g}else x.fillStyle=fill;x.fillText(txt,0,0);
 x.restore()}
function withCtx(cv,fn){const old=x;x=cv.getContext('2d');x.setTransform(BASE,0,0,BASE,0,0);x.clearRect(0,0,W,H);fn();x=old}

// ---------- audio (synthesised WebAudio; same code renders offline for the videos) ----------
let AC=null,MASTER=null,AUDIO_LOG=null;
function nbuf(ac){if(!ac._nb){const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);let s=12345;for(let i=0;i<d.length;i++){s=(s*1103515245+12345)&0x7fffffff;d[i]=s/0x3fffffff-1}ac._nb=b}return ac._nb}
function tone(ac,dst,type,f0,f1,t,dur,vol,att=.004){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+att);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dst);o.start(t);o.stop(t+dur+.03)}
function noise(ac,dst,t,dur,vol,ft,f0,f1,q=1){const s=ac.createBufferSource();s.buffer=nbuf(ac);s.loop=true;const f=ac.createBiquadFilter();f.type=ft;f.frequency.setValueAtTime(f0,t);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(f1,t+dur);f.Q.value=q;const g=ac.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(dst);s.start(t,(t*7.31)%1.5);s.stop(t+dur+.03)}
const SFX={
 hit:(a,d,t,v)=>{noise(a,d,t,.09,.55*v,'bandpass',1900,900,1.2);tone(a,d,'sine',170,48,t,.15,.8*v)},
 big:(a,d,t,v)=>{noise(a,d,t,.38,.75*v,'lowpass',3500,250);tone(a,d,'sine',130,34,t,.45,1*v);tone(a,d,'square',95,40,t,.22,.18*v)},
 rush:(a,d,t,v)=>{noise(a,d,t,.05,.3*v,'bandpass',2600,1800,2);tone(a,d,'square',700,320,t,.04,.07*v)},
 whoosh:(a,d,t,v)=>noise(a,d,t,.18,.28*v,'bandpass',450,2600,2),
 ding:(a,d,t,v)=>{tone(a,d,'square',988,988,t,.07,.13*v);tone(a,d,'square',1319,1319,t+.07,.28,.13*v)},
 mush:(a,d,t,v)=>[523,659,784,1047,1319].forEach((f,i)=>tone(a,d,'square',f,f,t+i*.045,.08,.09*v)),
 boing:(a,d,t,v)=>{tone(a,d,'sine',170,760,t,.32,.45*v);tone(a,d,'triangle',340,980,t,.26,.12*v)},
 ping:(a,d,t,v)=>{tone(a,d,'triangle',1500,950,t,.26,.32*v);tone(a,d,'sine',3000,3000,t,.08,.08*v)},
 combo:(a,d,t,v)=>{[523,659,784,1047,1568].forEach((f,i)=>tone(a,d,'square',f,f,t+i*.055,.11,.11*v));noise(a,d,t,.6,.25*v,'highpass',5000,7000)},
 banner:(a,d,t,v)=>{[196,247,294,392].forEach(f=>tone(a,d,'sawtooth',f,f,t,.7,.07*v,.01));noise(a,d,t,.5,.4*v,'lowpass',2500,200);tone(a,d,'sine',90,40,t,.5,.7*v)},
 ko:(a,d,t,v)=>{[131,165,196,262,330].forEach(f=>tone(a,d,'sawtooth',f,f*.98,t,1.3,.06*v,.01));noise(a,d,t,1,.3*v,'lowpass',1800,120)},
 boom:(a,d,t,v)=>{noise(a,d,t,1.1,.95*v,'lowpass',1500,90);tone(a,d,'sine',85,28,t,.9,1*v)},
 thunder:(a,d,t,v)=>{noise(a,d,t,.12,.9*v,'highpass',2500,1500);noise(a,d,t,1.7,.9*v,'lowpass',5000,150);tone(a,d,'sine',62,28,t,1.6,.9*v)},
 peel:(a,d,t,v)=>{noise(a,d,t,.75,.3*v,'highpass',2600,7000);noise(a,d,t+.05,.55,.22*v,'bandpass',1400,380,3)},
 pipe:(a,d,t,v)=>{for(let i=0;i<6;i++)tone(a,d,'square',720-i*95,600-i*95,t+i*.06,.06,.11*v)},
 pipeout:(a,d,t,v)=>{for(let i=0;i<6;i++)tone(a,d,'square',150+i*110,250+i*110,t+i*.05,.05,.11*v);noise(a,d,t,.3,.4*v,'lowpass',1200,300)},
 suck:(a,d,t,v)=>noise(a,d,t,.75,.35*v,'bandpass',300,2600,1.5),
 spit:(a,d,t,v)=>{tone(a,d,'sine',950,180,t,.14,.5*v);noise(a,d,t,.1,.3*v,'bandpass',1200,600)},
 gun:(a,d,t,v)=>noise(a,d,t,.045,.45*v,'bandpass',2200,1400,1),
 step:(a,d,t,v)=>noise(a,d,t,.035,.1*v,'bandpass',900,700),
 star:(a,d,t,v)=>[1568,2093,2637].forEach((f,i)=>tone(a,d,'triangle',f,f,t+i*.06,.14,.12*v)),
 score:(a,d,t,v)=>[1047,1319,1568,2093,2637,3136].forEach((f,i)=>tone(a,d,'square',f,f,t+i*.04,.07,.08*v)),
 zap:(a,d,t,v)=>{tone(a,d,'sawtooth',1800,200,t,.25,.12*v);noise(a,d,t,.2,.3*v,'highpass',3000,6000)},
 power:(a,d,t,v)=>{tone(a,d,'sawtooth',110,880,t,.9,.1*v,.05);noise(a,d,t,.9,.25*v,'bandpass',400,4000,2)},
 // music voices
 kick:(a,d,t,v)=>tone(a,d,'sine',150,42,t,.2,.55*v),
 snare:(a,d,t,v)=>{noise(a,d,t,.13,.26*v,'bandpass',2100,1500,.8);tone(a,d,'triangle',210,150,t,.08,.12*v)},
 hat:(a,d,t,v)=>noise(a,d,t,.035,.09*v,'highpass',8000,8000),
 bass:(a,d,t,v,f)=>tone(a,d,'square',f,f,t,.17,.085*v,.006),
 lead:(a,d,t,v,f)=>{tone(a,d,'square',f,f,t,.16,.045*v,.006);tone(a,d,'triangle',f*2,f*2,t,.12,.03*v)},
};
function sfx(name,v=1,f=0){if(G.ff)return;if(AUDIO_LOG){AUDIO_LOG.push([G.rt-G.rec0,name,v,f]);return}
 if(AC&&AC.state==='running'&&SFX[name])SFX[name](AC,MASTER,AC.currentTime+.01,v,f)}
function makeMaster(ac){const comp=ac.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=6;comp.attack.value=.003;comp.release.value=.15;const g=ac.createGain();g.gain.value=.62;g.connect(comp);comp.connect(ac.destination);return g}
function unlockAudio(){try{if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();MASTER=makeMaster(AC)}AC.resume()}catch(e){}}
async function renderAudio(dur){const sr=44100,ac=new OfflineAudioContext(1,Math.ceil(sr*dur),sr),m=makeMaster(ac);
 for(const [t,n,v,f] of AUDIO_LOG){if(t<dur&&SFX[n])SFX[n](ac,m,Math.max(0,t-1/30)+.001,v,f)}
 const buf=await ac.startRendering(),d=buf.getChannelData(0),out=new DataView(new ArrayBuffer(44+d.length*2));
 const ws=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
 ws(0,'RIFF');out.setUint32(4,36+d.length*2,true);ws(8,'WAVEfmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,1,true);out.setUint32(24,sr,true);out.setUint32(28,sr*2,true);out.setUint16(32,2,true);out.setUint16(34,16,true);ws(36,'data');out.setUint32(40,d.length*2,true);
 for(let i=0;i<d.length;i++)out.setInt16(44+i*2,clamp(d[i],-1,1)*32767,true);
 const u8=new Uint8Array(out.buffer);let s='';for(let i=0;i<u8.length;i+=32768)s+=String.fromCharCode.apply(null,u8.subarray(i,i+32768));return btoa(s)}
