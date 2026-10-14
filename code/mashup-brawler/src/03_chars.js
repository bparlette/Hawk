// ================= characters (all drawn in code, unit space: feet at 0,0, facing +x) =================
const glove=(r,c='#fff')=>(hx,hy)=>circ(hx,hy,r,c);
function fillOnly(col,fn){if(!P)return;x.beginPath();fn();x.fillStyle=FL?lite(col):col;x.fill()}
// ---------- SONIC ----------
function sonicShoe(fx,fy,a){x.save();x.translate(fx,fy);x.rotate(a*.5);ell(9,-3,15,8,'#e0262e');rr(-2,-10,8,12,2,'#fff');dot(2,-4,2,'#e8b72e');x.restore()}
function hedgeHead(o,BL,eyeCol,metal){
 x.save();x.translate(4,-108);x.rotate(o.hurt>.3?-.18:0);
 const L=metal?1.25:1;
 poly([-6,-26,-60*L,-46,-22,-10],BL);poly([-20,-8,-70*L,-6,-24,8],BL);poly([-18,6,-56*L,34,-8,18],BL);poly([2,-28,-10,-58*L,-22,-16],BL);
 circ(0,0,31,BL);poly([2,-24,8,-48,20,-22],BL);
 if(!metal){ell(19,13,19,13,'#f4c99c');}else{ell(19,13,19,12,'#8f9bb5')}
 if(o.hurt>.3){inkLine(()=>{x.moveTo(8,-12);x.lineTo(18,-6);x.lineTo(8,0);x.moveTo(32,-12);x.lineTo(24,-6);x.lineTo(32,0)},3.2)}
 else{sh(metal?'#111':'#fff',()=>{x.ellipse(13,-6,9.5,14,0,0,TAU);x.moveTo(36,-6);x.ellipse(27,-6,8.5,13,0,0,TAU)});fillOnly(metal?'#111':'#fff',()=>{x.ellipse(13,-6,8,12.5,0,0,TAU);x.ellipse(27,-6,7,11.5,0,0,TAU)});
  dot(17,-5,metal?4.5:5,eyeCol);dot(30,-5,metal?4:4.5,eyeCol);dot(18,-6,2.4,'#111');dot(31,-6,2.2,'#111');dot(19.5,-8.5,1.3,'#fff');
  if(!metal)inkLine(()=>{x.moveTo(6,-21);x.lineTo(20,-17)},3.5);else inkLine(()=>{x.moveTo(4,-20);x.lineTo(34,-14)},4)}
 ell(37,4,5.5,4.5,'#111');
 if(metal)inkLine(()=>{x.moveTo(14,19);x.lineTo(32,17);x.moveTo(18,15);x.lineTo(18,21);x.moveTo(24,15);x.lineTo(24,21)},2);
 else inkLine(()=>{o.hurt>.3?x.arc(24,22,5,3.6,5.8):x.arc(22,14,8,.4,1.9)},3);
 x.restore()}
const SONIC={K:2.45,sh:[7,-78],l1:19,l2:18,ar:4.6,hb:[2,-72,30,72],
 draw(o,s){const BL='#1f5fd6',PE='#f4c99c';
  if(o.ball){x.save();x.translate(0,-40);x.rotate(o.ballA||0);circ(0,0,40,BL);for(let i=0;i<3;i++){x.rotate(TAU/3);sh(BL,()=>{x.moveTo(0,-38);x.quadraticCurveTo(30,-30,36,8);x.quadraticCurveTo(18,-14,0,-38)})}
   ell(8,10,14,10,PE);x.restore();if(o.wpn)weapon(o.wpn,o,{hx:30,hy:-40,wd:(o.ballA||0)});return}
  leg(this,o,[-5,-46],22,21,5,BL,sonicShoe,0);
  backArm(this,o,[-6,-78],PE,glove(7.5));
  ell(0,-62,19,21,BL);ell(6,-58,11,15,PE);
  leg(this,o,[6,-46],22,21,5,BL,sonicShoe,1);
  hedgeHead(o,BL,'#2fae4a',false);
  frontArm(this,o,s,PE,glove(8.5))}};
const METAL={K:2.45,sh:[7,-78],l1:19,l2:18,ar:4.8,hb:[2,-72,30,72],
 draw(o,s){const sup=o.super,BL=sup?'#f0bb2a':'#26398c',ST=sup?'#ffe9a0':'#b8c2d6';
  if(sup&&P){x.save();x.globalAlpha=.35+.15*Math.sin(o.t*30);x.fillStyle='#ffe25a';x.beginPath();burst(0,-80,14,110,70,o.t*3);x.fill();x.restore()}
  const shoe=(fx,fy,a)=>{x.save();x.translate(fx,fy);x.rotate(a*.5);ell(9,-3,15,8,'#c22a3c');rr(-3,-10,9,12,2,ST);x.restore()};
  leg(this,o,[-5,-46],22,21,5,BL,shoe,0);
  backArm(this,o,[-6,-78],ST,glove(8,ST));
  ell(0,-62,19,21,BL);circ(6,-62,10,'#ffb52e');circ(6,-62,5,'#5a2a10');
  leg(this,o,[6,-46],22,21,5,BL,shoe,1);
  hedgeHead(o,BL,'#ff2a2a',true);
  frontArm(this,o,s,ST,(hx,hy)=>{circ(hx,hy,8,ST);poly([hx+4,hy-6,hx+14,hy-4,hx+6,hy],ST)})}};
// ---------- BOWSER ----------
function bowserFoot(fx,fy,a){x.save();x.translate(fx,fy);ell(8,-6,20,11,'#e9a93a');poly([22,-12,32,-8,22,-3],'#f6efd0');poly([20,-4,30,0,20,2],'#f6efd0');x.restore()}
function spikeCuff(hx,hy,a,r=12){x.save();x.translate(hx,hy);x.rotate(a);for(let i=0;i<4;i++){const q=i/4*TAU;poly([Math.cos(q)*r,Math.sin(q)*r,Math.cos(q+.3)*(r+9),Math.sin(q+.3)*(r+9),Math.cos(q+.6)*r,Math.sin(q+.6)*r],'#fff')}circ(0,0,r,'#2b2b33');x.restore()}
function bowserClaw(hx,hy,a){x.save();x.translate(hx,hy);x.rotate(a);circ(4,0,13,'#e9a93a');poly([12,-12,24,-10,14,-5],'#f6efd0');poly([14,-4,27,0,14,4],'#f6efd0');poly([12,5,24,10,12,11],'#f6efd0');x.restore()}
const BOWSER={K:2.3,sh:[22,-140],l1:30,l2:27,ar:11,hb:[4,-112,54,108],
 draw(o,s){const SK='#e9a93a',BE='#f7e8a8',SHL='#2f9a3a',HR='#e2461d',HO='#f6efd0';
  poly([-40,-52,-84,-36,-44,-24],SK);
  leg(this,o,[-16,-60],30,26,15,SK,bowserFoot,0);
  backArm(this,o,[-10,-140],SK,(hx,hy,a)=>{spikeCuff(lerp(hx,hx-Math.cos(a)*16,1),hy-Math.sin(a)*16,a,10);bowserClaw(hx,hy,a)});
  ell(-34,-122,54,72,'#f7f2e2');ell(-36,-122,45,63,SHL);
  [[-80,-168],[-92,-122],[-80,-76],[-48,-186],[-56,-122]].forEach(([sx,sy],i)=>{const a=Math.atan2(sy+122,sx+36);circ(sx,sy,10,'#fff');poly([sx+Math.cos(a+1.6)*8,sy+Math.sin(a+1.6)*8,sx+Math.cos(a)*24,sy+Math.sin(a)*24,sx+Math.cos(a-1.6)*8,sy+Math.sin(a-1.6)*8],HO)});
  ell(10,-110,42,60,BE);inkLine(()=>{for(let i=0;i<4;i++){x.moveTo(-24,-150+i*26);x.quadraticCurveTo(10,-142+i*26,44,-150+i*26)}},2.5);
  leg(this,o,[18,-58],30,26,15,SK,bowserFoot,1);
  x.save();x.translate(28,-188);x.rotate(o.hurt>.3?-.2:0);
  poly([-26,-28,-62,-46,-38,-18,-70,-20,-36,-4,-58,8,-24,12],HR);
  poly([-16,-24,-34,-64,-2,-30],HO);poly([8,-30,12,-70,26,-28],HO);
  ell(0,-2,36,32,SK);ell(32,10,30,21,'#f4d27c');
  dot(48,2,3,INK);dot(56,6,3,INK);
  poly([10,26,15,40,20,26],'#fff');poly([34,28,39,42,44,28],'#fff');inkLine(()=>{x.moveTo(6,26);x.quadraticCurveTo(30,34,58,22)},3);
  if(o.hurt>.3)inkLine(()=>{x.moveTo(6,-18);x.lineTo(22,-10);x.lineTo(6,-4)},3.5);else{ell(14,-12,9,11,'#fff');dot(17,-11,4.5,'#c81e1e');dot(18,-12,2,'#111')}
  poly([-2,-24,28,-22,26,-16,0,-16],HR);
  x.restore();
  frontArm(this,o,s,SK,(hx,hy,a)=>{spikeCuff(hx-Math.cos(a)*16,hy-Math.sin(a)*16,a,10);bowserClaw(hx,hy,a)})}};
// ---------- MARIO / LUIGI ----------
function plumberShoe(fx,fy,a){x.save();x.translate(fx,fy);ell(8,-4,15,8,'#6e3714');x.restore()}
function plumber(def,o,s,c){const SKN='#f6c6a0',OV=c.ov;
  leg(def,o,[-7,-40],18,17,7,OV,plumberShoe,0);
  backArm(def,o,[-8,-76],c.shirt,glove(8));
  ell(0,-60,24,26,c.shirt);
  sh(OV,()=>{x.moveTo(-16,-70);x.lineTo(16,-70);x.lineTo(22,-48);x.quadraticCurveTo(0,-30,-22,-48);x.closePath()});
  inkLine(()=>{x.moveTo(-14,-70);x.lineTo(-16,-84);x.moveTo(14,-70);x.lineTo(16,-84)},4);dot(-9,-64,3,'#ffd23a');dot(11,-64,3,'#ffd23a');
  leg(def,o,[7,-40],18,17,7,OV,plumberShoe,1);
  x.save();x.translate(6,-102);x.rotate(o.hurt>.3?-.2:0);
  ell(-16,6,10,13,'#5a2e12');circ(0,0,26,SKN);ell(-6,4,6,8,SKN);
  sh(c.cap,()=>{x.moveTo(-27,-6);x.bezierCurveTo(-26,-40,24,-40,26,-10);x.lineTo(-27,-6)});ell(22,-9,17,6,c.cap,-.08);
  circ(2,-20,8.5,'#fff');if(P){x.fillStyle=FL?'#fff':c.cap;x.font=`900 12px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.fillText(c.letter,2,-19.5)}
  if(o.hurt>.3)inkLine(()=>{x.moveTo(10,-4);x.lineTo(20,0);x.lineTo(10,4)},3);else{ell(16,-2,5,8,'#fff');dot(18,-1,3,'#2a5bd6');dot(18,-2,1.4,'#111')}
  ell(28,6,9.5,7.5,SKN);
  sh('#2a1608',()=>{x.moveTo(10,10);x.quadraticCurveTo(16,8,22,12);x.quadraticCurveTo(28,10,34,13);x.quadraticCurveTo(36,20,28,19);x.quadraticCurveTo(22,22,16,18);x.quadraticCurveTo(8,20,10,10)});
  x.restore();
  frontArm(def,o,s,c.shirt,glove(8.5))}
const MARIO={K:2.5,sh:[9,-78],l1:19,l2:17,ar:6,hb:[2,-64,28,64],draw(o,s){plumber(this,o,s,{shirt:'#e23b2e',cap:'#e23b2e',ov:'#2b5bd6',letter:'M'})}};
const LUIGI={K:2.75,sh:[9,-78],l1:19,l2:17,ar:5.6,hb:[2,-64,26,64],draw(o,s){plumber(this,o,s,{shirt:'#22a83a',cap:'#22a83a',ov:'#22328a',letter:'L'})}};
// ---------- GANONDORF ----------
const GANON={K:2.25,sh:[18,-152],l1:30,l2:28,ar:9,hb:[4,-120,42,112],
 draw(o,s){const SKN='#7a6c45',AR='#4b4560',GD='#d9a830',HR='#c8321e';
  sh('#2b1d3f',()=>{x.moveTo(-26,-176);x.quadraticCurveTo(-76,-80,-80+Math.sin(o.t*5)*6,-6);x.lineTo(-6,-10);x.lineTo(8,-170);x.closePath()});
  const boot=(fx,fy)=>{ell(fx+8,fy-5,15,9,'#2e2836')};
  leg(this,o,[-12,-82],40,38,12,'#3a3344',boot,0);
  backArm(this,o,[-18,-152],SKN,(hx,hy)=>circ(hx,hy,11,'#3a3344'));
  poly([-36,-176,36,-176,30,-80,-30,-80],AR);inkLine(()=>{x.moveTo(-30,-150);x.lineTo(30,-150);x.moveTo(0,-176);x.lineTo(0,-84)},2.5);
  if(P){x.strokeStyle=GD;x.lineWidth=4;x.beginPath();x.moveTo(-32,-172);x.lineTo(32,-172);x.moveTo(-28,-120);x.lineTo(28,-120);x.stroke()}
  circ(0,-134,7,'#3ee0d0');rr(-32,-92,64,14,3,'#7a5a2a');circ(0,-85,6,GD);
  leg(this,o,[12,-82],40,38,12,'#3a3344',boot,1);
  ell(-24,-170,20,14,'#3a3448');
  x.save();x.translate(14,-200);x.rotate(o.hurt>.3?-.2:0);
  poly([-18,-20,-52,-34,-28,-8,-56,-2,-26,8,-36,24,-12,14],HR);
  ell(2,0,22,27,SKN);
  poly([-14,14,-8,44,4,30,10,48,16,30,26,40,22,14],HR);
  rr(-20,-20,44,8,3,GD);circ(6,-16,4.5,'#3ee0d0');
  if(o.hurt>.3)inkLine(()=>{x.moveTo(6,-6);x.lineTo(16,-2);x.lineTo(6,2)},3);else{ell(12,-4,6,3.5,'#ffd84a');dot(14,-4,1.6,'#7a3a00')}
  inkLine(()=>{x.moveTo(2,-12);x.lineTo(22,-7)},4);poly([20,-2,30,8,20,10],SKN);inkLine(()=>{x.moveTo(12,18);x.lineTo(24,16)},2.5);
  x.restore();
  ell(24,-170,22,15,'#3a3448');inkLine(()=>{x.arc(24,-170,14,3.6,5.8)},2);
  frontArm(this,o,s,SKN,(hx,hy,a)=>{circ(hx,hy,12,'#3a3344');circ(hx-Math.cos(a)*12,hy-Math.sin(a)*12,10,'#3a3344')})}};
// ---------- DONKEY KONG / DIDDY ----------
const DK={K:2.3,sh:[22,-122],l1:34,l2:30,ar:13,hb:[6,-92,50,90],
 draw(o,s){const FU='#7b4a24',PE='#f0c08c';
  const foot=(fx,fy)=>ell(fx+8,fy-5,17,9,PE);
  leg(this,o,[-18,-48],22,20,12,FU,foot,0);
  backArm(this,o,[-20,-122],FU,glove(14,PE));
  ell(0,-90,50,54,FU);
  leg(this,o,[16,-48],22,20,12,FU,foot,1);
  x.save();x.translate(34,-150);x.rotate(o.hurt>.3?-.2:0);
  poly([-10,-28,-4,-46,4,-30,12,-44,14,-26],FU);circ(0,0,32,FU);
  sh(PE,()=>{x.moveTo(0,-14);x.bezierCurveTo(4,-30,22,-28,22,-14);x.bezierCurveTo(30,-28,46,-22,40,-6);x.bezierCurveTo(36,4,6,6,0,-14)});
  ell(26,12,23,15,PE);dot(32,6,2.6,INK);dot(40,6,2.6,INK);
  if(o.hurt>.3)inkLine(()=>{x.moveTo(12,-14);x.lineTo(20,-10);x.lineTo(12,-6)},3);else{ell(16,-11,5.5,7,'#fff');ell(31,-11,5,6.5,'#fff');dot(18,-10,2.8,'#3a1a08');dot(33,-10,2.6,'#3a1a08')}
  inkLine(()=>{x.moveTo(8,-20);x.lineTo(24,-18);x.lineTo(40,-20)},4);inkLine(()=>{x.moveTo(14,18);x.quadraticCurveTo(28,26,44,16)},3);
  x.restore();
  poly([18,-126,36,-126,31,-112,40,-72,26,-62,13,-112],'#e2322a');
  if(P){x.save();x.translate(28,-96);x.rotate(.15);x.fillStyle='#ffd23a';x.font=`900 10px ${FONT}`;x.textAlign='center';x.fillText('DK',0,0);x.restore()}
  frontArm(this,o,s,FU,glove(14,PE))}};
const DIDDY={K:2.2,sh:[8,-60],l1:14,l2:13,ar:5,hb:[2,-52,24,52],
 draw(o,s){const FU='#6e3e1c',PE='#f0c08c';
  ln(()=>{x.moveTo(-12,-34);x.bezierCurveTo(-40,-30,-44,-60,-28,-64)},FU,4);
  const foot=(fx,fy)=>ell(fx+6,fy-4,11,6,PE);
  leg(this,o,[-6,-30],14,13,5,FU,foot,0);backArm(this,o,[-6,-60],FU,glove(6,PE));
  ell(0,-46,17,20,'#e23b2e');if(P){x.fillStyle='#ffd23a';x.beginPath();star5(4,-48,6,2.6);x.fill()}
  leg(this,o,[6,-30],14,13,5,FU,foot,1);
  x.save();x.translate(4,-82);circ(0,0,20,FU);ell(-20,0,7,9,PE);ell(10,4,14,11,PE);
  sh('#e23b2e',()=>{x.moveTo(-20,-6);x.bezierCurveTo(-18,-30,18,-30,20,-8);x.closePath()});ell(18,-8,12,4,'#e23b2e');
  ell(8,-2,4,5.5,'#fff');ell(18,-2,4,5.5,'#fff');dot(9,-1,2,'#111');dot(19,-1,2,'#111');inkLine(()=>{x.arc(14,8,6,.3,2.6)},2.5);x.restore();
  frontArm(this,o,s,FU,glove(6.5,PE))}};
// ---------- ROBOTNIK in the EGG MOBILE ----------
const EGG={K:2.2,sh:[16,-112],l1:20,l2:18,ar:7,hb:[0,-80,64,62],
 draw(o,s){const RD='#d8262c';
  if(P){for(let i=0;i<2;i++){const fx=-28+i*44,fl=26+hs(Math.floor(o.t*24)+i*7)*16;x.fillStyle='#ffb62e';x.beginPath();x.moveTo(fx-11,-24);x.quadraticCurveTo(fx,fl+6,fx+11,-24);x.fill();x.fillStyle='#fff5b0';x.beginPath();x.moveTo(fx-5,-24);x.quadraticCurveTo(fx,fl*.6,fx+5,-24);x.fill()}}
  backArm(this,o,[-12,-112],RD,glove(7));
  ell(0,-110,32,28,RD);dot(8,-120,3,'#ffd23a');dot(8,-106,3,'#ffd23a');
  x.save();x.translate(8,-150);x.rotate(o.hurt>.3?-.2:0);
  ell(0,0,25,28,'#f7b79c');rr(-24,-26,48,8,4,'#2b2b33');circ(-9,-24,7,'#7cc8ff');circ(9,-24,7,'#7cc8ff');
  if(o.hurt>.3)inkLine(()=>{x.moveTo(6,-4);x.lineTo(14,0);x.lineTo(6,4);x.moveTo(26,-4);x.lineTo(18,0);x.lineTo(26,4)},2.5);
  else{ell(10,-1,7,6,'#5ab6ff');ell(24,-1,6,6,'#5ab6ff');dot(12,0,2,'#111');dot(25,0,2,'#111')}
  ell(26,8,9,8,'#ffb3a0');
  sh('#d06a1e',()=>{x.moveTo(8,12);x.bezierCurveTo(-10,10,-30,22,-38,38);x.bezierCurveTo(-20,30,-4,30,14,22);x.bezierCurveTo(30,30,48,30,60,36);x.bezierCurveTo(52,20,36,10,20,12);x.closePath()});
  x.restore();
  sh('#e9eef4',()=>{x.moveTo(-66,-86);x.lineTo(66,-86);x.bezierCurveTo(66,-50,40,-28,0,-28);x.bezierCurveTo(-40,-28,-66,-50,-66,-86);x.closePath()});
  sh('#2c2c38',()=>{x.moveTo(-58,-56);x.bezierCurveTo(-40,-30,40,-30,58,-56);x.bezierCurveTo(44,-22,-44,-22,-58,-56)});
  rr(-66,-92,132,10,5,'#c9d1db');if(P){x.fillStyle=RD;x.fillRect(-50,-74,100,6)}
  dot(-40,-80,2.5,INK);dot(0,-80,2.5,INK);dot(40,-80,2.5,INK);
  if(P){x.save();x.globalAlpha*=.35;x.fillStyle='#bff0ff';x.beginPath();x.moveTo(20,-92);x.quadraticCurveTo(40,-140,62,-92);x.fill();x.restore()}
  if(o.punch>0){const L=o.punch*70;cap(50,-62,50+L,-62,6,'#9aa4ae');circ(60+L,-62,16,'#e23b2e');circ(52+L,-62,8,'#fff')}
  frontArm(this,o,s,RD,glove(7.5))}};
// ---------- KIRBY ----------
const KIRBY={K:3.0,sh:[18,-30],l1:9,l2:8,ar:6.5,hb:[0,-40,40,40],
 draw(o,s){const PK='#ffa6c9',RD='#d81f4a',r=o.puff?48:38;
  if(o.hat&&P!==null){x.save();ln(()=>{x.moveTo(-26,-62);x.quadraticCurveTo(-52,-60+Math.sin(o.t*20)*6,-70,-48+Math.sin(o.t*18)*8)},'#e2262e',7);ln(()=>{x.moveTo(-26,-58);x.quadraticCurveTo(-48,-48+Math.sin(o.t*22)*6,-62,-34)},'#e2262e',6);x.restore()}
  ell(-16,-6,18,10,RD,-.1);
  backArm(this,o,[-24,-40],PK,glove(8,PK));
  circ(0,-40,r,PK);
  if(o.hat)sh('#e2262e',()=>{x.moveTo(-34,-58);x.quadraticCurveTo(0,-76,32,-62);x.lineTo(30,-52);x.quadraticCurveTo(0,-66,-34,-48);x.closePath()});
  ell(18,-6,18,10,RD,.1);
  if(o.hurt>.3){inkLine(()=>{x.moveTo(4,-56);x.lineTo(13,-50);x.lineTo(4,-44);x.moveTo(30,-56);x.lineTo(21,-50);x.lineTo(30,-44)},3)}
  else if(!o.inhale){ell(10,-50,5,12,'#1a2266');ell(24,-50,5,12,'#1a2266');ell(10,-56,2.4,4.5,'#fff');ell(24,-56,2.4,4.5,'#fff')}
  else inkLine(()=>{x.moveTo(4,-56);x.lineTo(14,-52);x.moveTo(30,-56);x.lineTo(20,-52)},3.5);
  ell(2,-36,7,4,'#ff6f9a');ell(34,-36,6,4,'#ff6f9a');
  if(o.inhale){ell(22,-28,15*o.inhale,13*o.inhale,'#a3123a')}else if(o.puff){inkLine(()=>{x.moveTo(14,-28);x.lineTo(26,-28)},3)}else inkLine(()=>{x.arc(18,-34,5,.3,2.8)},2.5);
  if(!o.puff)frontArm(this,o,s,PK,glove(8.5,PK))}};
// ---------- MR. X and goons ----------
const MRX={K:2.3,sh:[16,-150],l1:26,l2:24,ar:8.5,hb:[2,-108,36,102],
 draw(o,s){const SU='#2e2440',SKN='#e8b38e';const shoe=(fx,fy)=>ell(fx+7,fy-4,14,7,'#111');
  leg(this,o,[-10,-88],44,40,10,'#1d1a26',shoe,0);backArm(this,o,[-14,-150],SU,glove(8,SKN));
  poly([-30,-170,30,-170,26,-84,-26,-84],SU);poly([-10,-170,10,-170,0,-130],'#fff');poly([-3,-166,3,-166,5,-132,0,-124,-5,-132],'#d01e3a');
  inkLine(()=>{x.moveTo(-10,-170);x.lineTo(-4,-118);x.moveTo(10,-170);x.lineTo(4,-118)},3);
  if(P){x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=1.4;x.beginPath();for(let i=-24;i<28;i+=8){x.moveTo(i,-166);x.lineTo(i*.9,-88)}x.stroke()}
  leg(this,o,[10,-88],44,40,10,'#1d1a26',shoe,1);
  x.save();x.translate(8,-190);x.rotate(o.hurt>.3?-.2:0);rr(-8,12,16,12,3,SKN);ell(0,0,20,24,SKN);
  sh('#1b1414',()=>{x.moveTo(-21,2);x.bezierCurveTo(-24,-30,18,-34,22,-8);x.lineTo(10,-14);x.quadraticCurveTo(-6,-14,-21,2)});
  rr(2,-8,24,9,3,'#111');if(P){x.fillStyle='rgba(255,255,255,.6)';x.fillRect(6,-6,6,2)}
  inkLine(()=>{o.hurt>.3?x.arc(14,16,4,3.6,5.8):(x.moveTo(8,12),x.lineTo(18,10))},2.5);
  if(!o.hurt){rr(16,9,16,4,2,'#7a4a22');dot(33,11,2.4,'#ff7a2a');if(P){x.save();x.globalAlpha*=.4;x.fillStyle='#ddd';for(let i=0;i<3;i++){const k=((o.t*.8+i/3)%1+1)%1;x.beginPath();x.arc(36+k*6,4-k*40,4+k*8,0,TAU);x.fill()}x.restore()}}
  x.restore();
  frontArm(this,o,s,SU,(hx,hy)=>{circ(hx,hy,8.5,SKN);dot(hx+3,hy-4,2,'#ffd23a')})}};
function goonDef(c){return{K:2.3,sh:[14,-118],l1:24,l2:22,ar:8.5,hb:[2,-90,30,88],
 draw(o,s){const shoe=(fx,fy)=>ell(fx+7,fy-4,14,8,'#3a2a1a');
  leg(this,o,[-10,-62],32,30,10.5,c.pants,shoe,0);backArm(this,o,[-6,-118],c.skin,glove(9,c.skin));
  poly([-26,-128,26,-128,22,-58,-22,-58],c.shirt);if(c.vest)poly([-26,-128,-8,-128,-6,-60,-22,-58],c.vest);if(c.vest)poly([26,-128,10,-128,8,-60,22,-58],c.vest);
  leg(this,o,[10,-62],32,30,10.5,c.pants,shoe,1);
  x.save();x.translate(4,-150);x.rotate(o.hurt>.3?-.25:0);ell(0,0,22,24,c.skin);
  if(c.mohawk)poly([-14,-18,-6,-46,2,-22,8,-44,12,-20],c.hair);else sh(c.hair,()=>{x.moveTo(-22,0);x.bezierCurveTo(-26,-30,20,-32,22,-10);x.lineTo(-22,0)});
  if(o.hurt>.3)inkLine(()=>{x.moveTo(6,-6);x.lineTo(14,-2);x.lineTo(6,2);x.moveTo(22,-6);x.lineTo(16,-2);x.lineTo(22,2)},2.5);
  else{dot(9,-3,3,INK);dot(19,-3,3,INK);inkLine(()=>{x.moveTo(3,-12);x.lineTo(13,-8);x.moveTo(24,-12);x.lineTo(16,-8)},3.4)}
  inkLine(()=>{x.moveTo(8,13);x.lineTo(19,11)},2.5);x.restore();
  frontArm(this,o,s,c.skin,glove(9.5,c.skin))}}}
const GOON1=goonDef({skin:'#e0a37a',shirt:'#f2f2f2',vest:'#3a6ec2',pants:'#2f4f8f',hair:'#7a4a1a'});
const GOON2=goonDef({skin:'#c98a5e',shirt:'#f08a24',pants:'#3a3a48',hair:'#ffd23a',mohawk:1});
// ---------- SAMUS ----------
const SAMUS={K:2.3,sh:[14,-140],l1:24,l2:22,ar:8,hb:[2,-96,32,96],
 draw(o,s){const OR='#e2562a',YE='#f2c230',GR='#2fd36a';
  if(o.ball){x.save();x.translate(0,-26);if(P){x.save();x.globalAlpha=.4;x.fillStyle='#ffe25a';x.beginPath();x.arc(0,0,40,0,TAU);x.fill();x.restore()}circ(0,0,26,YE);x.rotate(o.ballA||0);
   sh(OR,()=>{x.ellipse(0,0,26,9,0,0,TAU)});sh(OR,()=>{x.ellipse(0,0,9,26,0,0,TAU)});circ(0,0,7,'#ffef9a');x.restore();return}
  const boot=(fx,fy)=>{ell(fx+7,fy-5,15,9,OR)};
  leg(this,o,[-8,-78],38,36,10.5,OR,boot,0);
  const B=o.B||[1.0+Math.sin(o.t*4)*.05,.5];const ex=-6+Math.sin(B[0])*22,ey=-140+Math.cos(B[0])*22,hx=ex+Math.sin(B[0]+B[1])*20,hy=ey+Math.cos(B[0]+B[1])*20,ca=Math.atan2(Math.cos(B[0]+B[1]),Math.sin(B[0]+B[1]));
  circ(-14,-142,19,YE);cap(-6,-140,ex,ey,9,OR);x.save();x.translate(hx,hy);x.rotate(ca);rr(-10,-12,46,24,8,OR);rr(30,-9,12,18,4,'#5a5f6a');circ(42,0,6,GR);x.restore();
  ell(0,-110,25,34,OR);poly([-18,-128,18,-128,14,-104,-14,-104],YE);inkLine(()=>{x.moveTo(-12,-94);x.lineTo(12,-94);x.moveTo(-12,-86);x.lineTo(12,-86)},2.2);rr(-20,-82,40,10,3,YE);
  leg(this,o,[8,-78],38,36,10.5,OR,boot,1);
  x.save();x.translate(6,-170);x.rotate(o.hurt>.3?-.2:0);circ(0,0,22,OR);sh(GR,()=>{x.moveTo(-2,-8);x.lineTo(22,-8);x.quadraticCurveTo(26,4,20,12);x.lineTo(2,12);x.quadraticCurveTo(-4,2,-2,-8)});
  if(P){x.fillStyle='rgba(255,255,255,.55)';x.fillRect(4,-6,10,3)}poly([-4,-20,4,-26,12,-20,4,-18],'#c8321e');x.restore();
  circ(18,-142,21,YE);inkLine(()=>{x.arc(18,-142,13,3.4,5.9)},2.2);
  frontArm(this,o,s,OR,glove(8.5,'#c8452a'))}};
const CHAR={sonic:SONIC,metal:METAL,bowser:BOWSER,mario:MARIO,luigi:LUIGI,ganon:GANON,dk:DK,diddy:DIDDY,egg:EGG,kirby:KIRBY,mrx:MRX,goon1:GOON1,goon2:GOON2,samus:SAMUS};
