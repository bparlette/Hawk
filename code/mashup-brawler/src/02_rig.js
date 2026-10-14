// ================= rig: arms, legs, weapons, kinematics =================
const REST=[0.7,0.9,-0.95];
const KF={
 slash:[[-.18,REST],[-.06,[2.8,.3,-.6]],[0,[1.6,0,-.15]],[.12,[1.0,.1,.3]],[.3,REST]],
 jab:[[-.18,REST],[-.06,[-.3,1.9,-.1]],[0,[1.57,0,-.05]],[.13,[1.5,.05,-.05]],[.3,REST]],
 upper:[[-.18,REST],[-.06,[.2,.4,-.2]],[0,[2.1,-.1,-.5]],[.13,[2.7,0,-.6]],[.3,REST]],
 claw:[[-.3,REST],[-.08,[2.6,.4,-.4]],[0,[1.25,.15,.1]],[.12,[.95,.1,.2]],[.3,REST]],
 low:[[-.3,REST],[-.08,[2.4,.6,-.3]],[0,[.9,.35,0]],[.12,[.8,.3,0]],[.3,REST]],
 slam:[[-.3,REST],[-.08,[3.0,.1,-.4]],[0,[1.3,.1,.1]],[.15,[1.1,.1,.2]],[.4,REST]],
};
function kfA(type,k){const K=KF[type]||KF.slash;if(k<=K[0][0])return K[0][1];for(let i=1;i<K.length;i++){if(k<=K[i][0]){const u=ease(seg(k,K[i-1][0],K[i][0]));return K[i-1][1].map((v,j)=>lerp(v,K[i][1][j],u))}}return K[K.length-1][1]}
const WLEN={master:86,broad:92,pipe:74,fists:22,none:10,claw:16,fist:12,band:10};
function armSolve(def,o){const A0=o.A||REST,A=[A0[0]+(def.dip||0),A0[1],A0[2]],sp=o.shp||def.sh,sx=sp[0],sy=sp[1];
 const ex=sx+Math.sin(A[0])*def.l1,ey=sy+Math.cos(A[0])*def.l1,hx=ex+Math.sin(A[0]+A[1])*def.l2,hy=ey+Math.cos(A[0]+A[1])*def.l2;
 return{sx,sy,ex,ey,hx,hy,wd:Math.atan2(Math.cos(A[0]+A[1]),Math.sin(A[0]+A[1]))+A[2]}}
function nunGeo(s,o){const a=s.wd,lag=o.nlag||0,c=Math.cos(a),n=Math.sin(a);const p1=[s.hx+c*30,s.hy+n*30],b=a+lag*.5,p2=[p1[0]+Math.cos(b)*20,p1[1]+Math.sin(b)*20],d=a+lag;return{p1,p2,d,tip:[p2[0]+Math.cos(d)*44,p2[1]+Math.sin(d)*44]}}
function wTipLocal(o,s){const w=o.wpn||'none';if(w==='nunch')return nunGeo(s,o).tip;const L=(WLEN[w]||10)*(o.wsc||1);return[s.hx+Math.cos(s.wd)*L,s.hy+Math.sin(s.wd)*L]}
function toW(def,o,lx,ly){const K=def.K*(o.sc||1),c=Math.cos(o.lean||0),n=Math.sin(o.lean||0);const rx=lx*c-ly*n,ry=lx*n+ly*c;return[o.x+(o.face||1)*rx*K,o.y+ry*K*(o.sy||1)]}
function tipW(def,o){const s=armSolve(def,o);const t=wTipLocal(o,s);return toW(def,o,t[0],t[1])}
// a point 80% of the way from hand to tip: where sparks sit (inside the target)
function hitW(def,o,f=.78){const s=armSolve(def,o),t=wTipLocal(o,s);return toW(def,o,lerp(s.hx,t[0],f),lerp(s.hy,t[1],f))}
function boxW(def,o){const b=def.hb,K=def.K*(o.sc||1);return{x:o.x+(o.face||1)*b[0]*K,y:o.y+b[1]*K,rx:b[2]*K,ry:b[3]*K}}
function inBox(p,b,pad=0){const dx=(p[0]-b.x)/(b.rx+pad),dy=(p[1]-b.y)/(b.ry+pad);return dx*dx+dy*dy<=1}

// ---------- weapons (drawn in hand space, +x = along the forearm) ----------
function tail(len,w,col){sh(col,()=>{x.moveTo(0,-w*.5);x.bezierCurveTo(len*.4,-w*1.2,len*.8,-w*1.1,len,0);x.bezierCurveTo(len*.8,w*1.1,len*.4,w*1.2,0,w*.5);x.closePath()});
 sh('#fff8ef',()=>{x.moveTo(len*.62,-w*.86);x.bezierCurveTo(len*.8,-w*1.0,len*.95,-w*.4,len,0);x.bezierCurveTo(len*.95,w*.4,len*.8,w*1.0,len*.62,w*.86);x.quadraticCurveTo(len*.7,0,len*.62,-w*.86)})}
function weapon(w,o,s){if(!w||w==='none'||w==='claw'||w==='fist')return;const hx=s.hx,hy=s.hy,a=s.wd;
 if(w==='nunch'){const g=nunGeo(s,o);x.save();x.translate(hx,hy);x.rotate(a);x.translate(-4,0);tail(36,13,'#f39a2c');x.restore();
  ln(()=>{x.moveTo(g.p1[0],g.p1[1]);x.lineTo(g.p2[0],g.p2[1])},'#c9ced8',3);
  for(let i=0;i<4;i++){const u=i/3;ell(lerp(g.p1[0],g.p2[0],u),lerp(g.p1[1],g.p2[1],u),3,2,'#dfe3ea',a)}
  x.save();x.translate(g.p2[0],g.p2[1]);x.rotate(g.d);tail(46,15,'#f39a2c');x.restore();return}
 x.save();x.translate(hx,hy);x.rotate(a);if(o.wsc)x.scale(o.wsc,o.wsc);
 if(w==='master'){cap(-17,0,-2,0,3.6,'#3b3fa6');circ(-19,0,4.2,'#d9b23a');
  poly([6,-5.5,70,-5.5,86,0,70,5.5,6,5.5],'#e8eef7');inkLine(()=>{x.moveTo(10,0);x.lineTo(64,0)},1.6);
  if(P){x.fillStyle='rgba(255,255,255,.9)';x.fillRect(12,-4,50,2)}
  poly([0,-15,7,-5,7,5,0,15,-4,10,-1,0,-4,-10],'#5b4fd0');circ(3,0,3.2,'#ffd84a')}
 else if(w==='broad'){cap(-19,0,-3,0,4.2,'#6a3e1e');circ(-21,0,5,'#e2b23c');
  poly([3,-8.5,78,-8.5,93,0,78,8.5,3,8.5],'#d4dce6');inkLine(()=>{x.moveTo(8,0);x.lineTo(72,0)},1.6);
  if(P){x.fillStyle='rgba(255,255,255,.85)';x.fillRect(10,-6.5,60,2.5)}
  rr(-3,-17,7,34,2,'#e2b23c')}
 else if(w==='pipe'){cap(-26,0,74,0,6.2,'#98a2ad');ell(16,0,3,7.2,'#6f7884');ell(48,0,3,7.2,'#6f7884');ell(74,0,3,6.4,'#5e6672');if(P){x.fillStyle='rgba(255,255,255,.7)';x.fillRect(-20,-4,90,2.2)}}
 else if(w==='fists'){poly([6,-12,27,-8,9,-4],'#f4efe0');poly([6,3,27,7,9,11],'#f4efe0');circ(2,0,14.5,'#ffffff');inkLine(()=>{x.moveTo(8,-7);x.lineTo(14,-6);x.moveTo(9,0);x.lineTo(15,0);x.moveTo(8,7);x.lineTo(14,6)},2)}
 else if(w==='band'){}
 x.restore()}
function frontArm(def,o,s,col,handFn){cap(s.sx,s.sy,s.ex,s.ey,def.ar,col);cap(s.ex,s.ey,s.hx,s.hy,def.ar*.9,col);weapon(o.wpn,o,s);if(o.wpn!=='fists'&&handFn)handFn(s.hx,s.hy,s.wd)}
function backArm(def,o,sp,col,handFn){const B=o.B||[.35+Math.sin((o.t||0)*4)*.06,1.1];const ex=sp[0]+Math.sin(B[0])*def.l1*.95,ey=sp[1]+Math.cos(B[0])*def.l1*.95,hx=ex+Math.sin(B[0]+B[1])*def.l2*.95,hy=ey+Math.cos(B[0]+B[1])*def.l2*.95;
 cap(sp[0],sp[1],ex,ey,def.ar*.95,col);cap(ex,ey,hx,hy,def.ar*.85,col);const a=Math.atan2(Math.cos(B[0]+B[1]),Math.sin(B[0]+B[1]));
 if(o.wpn==='fists'||o.bfists){x.save();x.translate(hx,hy);x.rotate(a);poly([6,-12,27,-8,9,-4],'#f4efe0');poly([6,3,27,7,9,11],'#f4efe0');circ(2,0,14.5,'#fff');x.restore()}else if(handFn)handFn(hx,hy,a)}
function legAng(o,which){const w=o.walk||0;
 if(o.kick&&which)return[lerp(.25,1.75,o.kick),lerp(-.1,0,o.kick)];
 if(o.jump)return which?[1.0,-1.5]:[.25,-1.2];
 if(o.walk){const s=which?Math.sin(w):-Math.sin(w);return[s*.6,-Math.max(0,-s)*.9-.05]}
 return which?[.32,-.12]:[-.28,-.05]}
function leg(def,o,hp,l1,l2,r,col,foot,which){const [a1,a2]=legAng(o,which);const ex=hp[0]+Math.sin(a1)*l1,ey=hp[1]+Math.cos(a1)*l1,fx=ex+Math.sin(a1+a2)*l2,fy=ey+Math.cos(a1+a2)*l2;cap(hp[0],hp[1],ex,ey,r,col);cap(ex,ey,fx,fy,r*.9,col);if(foot)foot(fx,fy,Math.atan2(Math.cos(a1+a2),Math.sin(a1+a2))-Math.PI/2)}
function eye(cx,cy,rx,ry,pc,hurt,px=.35,py=0){if(hurt){inkLine(()=>{x.moveTo(cx-rx,cy-ry*.5);x.lineTo(cx+rx*.6,cy);x.lineTo(cx-rx,cy+ry*.5)},3);return}
 ell(cx,cy,rx,ry,'#fff');dot(cx+rx*px,cy+ry*py,Math.min(rx,ry)*.55,pc);dot(cx+rx*px+1.5,cy+ry*py-2,Math.min(rx,ry)*.18,'#fff')}

// ---------- generic character renderer ----------
function drawChar(def,o){if(!o||o.hide)return;const K=def.K*(o.sc||1);
 const gy=o.gy||GY;if(o.shadow!==false&&o.y>gy-400){x.save();x.globalAlpha=.28*clamp(1-(gy-o.y)/400);x.fillStyle='#000';x.beginPath();x.ellipse(o.x+(o.face||1)*def.hb[0]*K,gy+6,def.hb[2]*K*.95,13*(o.sc||1),0,0,TAU);x.fill();x.restore()}
 const s=armSolve(def,o);o.t=o.t||0;
 for(P=0;P<2;P++){x.save();x.globalAlpha*=(o.alpha==null?1:o.alpha);x.translate(o.x,o.y);
  if(o.rot){const cy=def.hb[1]*K;x.translate(0,cy);x.rotate(o.rot);x.translate(0,-cy)}
  x.scale((o.face||1)*K*(o.sx||1),K*(o.sy||1));x.rotate(o.lean||0);FL=(P&&o.flash>.5)?1:0;
  def.draw(o,s);FL=0;x.restore()}P=1}

// motion smear for fast swings: a translucent arc following the weapon tip
function smear(def,o,k,col='#fff6a8'){if(k<-.06||k>.1)return;const a=.85*(1-Math.abs(k)/.1);const p=[];for(let i=0;i<7;i++){const kk=k-i*.012;const oo=Object.assign({},o,{A:kfA(o.atk.type,kk)});p.push(tipW(def,oo))}
 x.save();x.globalAlpha=a;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#fff';x.lineWidth=30*(o.sc||1);x.beginPath();p.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.stroke();x.strokeStyle=col;x.lineWidth=16*(o.sc||1);x.stroke();x.restore()}
