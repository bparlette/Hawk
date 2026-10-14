// ================= backgrounds & props (world px, LW>1 for chunkier outlines) =================
function wrap(v,p){return((v%p)+p)%p}
function grad(y0,y1,stops){const g=x.createLinearGradient(0,y0,0,y1);stops.forEach((c,i)=>g.addColorStop(i/(stops.length-1),c));return g}
function cloud(cx,cy,s){x.save();x.translate(cx,cy);x.scale(s,s);LW=1.6;sticker(()=>{sh('#ffffff',()=>{x.arc(-60,10,40,0,TAU);x.moveTo(40,0);x.arc(0,-10,55,0,TAU);x.moveTo(110,10);x.arc(65,10,42,0,TAU);x.rect(-60,10,125,40)})});LW=1;x.restore()}
function checker(X,Y,w,h,s,c1,c2,ox=0){x.save();x.beginPath();x.rect(X,Y,w,h);x.clip();x.fillStyle=c1;x.fillRect(X,Y,w,h);x.fillStyle=c2;const sx=Math.floor((X-ox)/s)-1;for(let i=sx;i*s+ox<X+w;i++)for(let j=0;j*s<h;j++)if((i+j)%2==0)x.fillRect(i*s+ox,Y+j*s,s,s);x.restore()}
// ---- props ----
function qblock(cx,cy,s,used,t){x.save();x.translate(cx,cy);LW=1.3;sticker(()=>{rr(-s/2,-s/2,s,s,8,used?'#a86a32':'#f7b52a');if(P){if(!used){x.fillStyle='#fff6c8';x.font=`900 ${s*.62}px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.strokeStyle=INK;x.lineWidth=5;x.strokeText('?',2,3);x.fillText('?',2,3)}
 x.fillStyle=INK;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>{x.beginPath();x.arc(a*s*.36,b*s*.36,3.5,0,TAU);x.fill()})}});LW=1;x.restore()}
function brick(cx,cy,s){x.save();x.translate(cx,cy);LW=1.3;sticker(()=>{rr(-s/2,-s/2,s,s,4,'#c4622a');inkLine(()=>{x.moveTo(-s/2,0);x.lineTo(s/2,0);x.moveTo(0,-s/2);x.lineTo(0,0);x.moveTo(-s/4,0);x.lineTo(-s/4,s/2);x.moveTo(s/4,0);x.lineTo(s/4,s/2)},3)});LW=1;x.restore()}
function mushroom(cx,cy,s,rot=0){x.save();x.translate(cx,cy);x.rotate(rot);x.scale(s,s);LW=1/s*1.2;sticker(()=>{rr(-14,-4,28,26,8,'#fbe9c8');sh('#e8322a',()=>{x.moveTo(-30,4);x.bezierCurveTo(-32,-34,32,-34,30,4);x.closePath()});circ(-14,-10,6,'#fff');circ(10,-16,7,'#fff');circ(16,0,4,'#fff');dot(-5,10,2.4,INK);dot(5,10,2.4,INK)});LW=1;x.restore()}
function pipeV(cx,top,bot,w=150,col='#3fbf3a'){LW=1.4;sticker(()=>{rr(cx-w*.42,top+40,w*.84,bot-top-40,0,col);rr(cx-w/2,top,w,48,8,col);if(P){x.fillStyle='rgba(255,255,255,.35)';x.fillRect(cx-w*.3,top+50,14,bot-top-60);x.fillRect(cx-w*.4,top+8,16,30)}});LW=1}
function pipeH(left,cy,right,h=210,col='#3fbf3a'){LW=1.4;sticker(()=>{rr(left+40,cy-h*.42,right-left-40,h*.84,0,col);rr(left,cy-h/2,52,h,8,col);if(P){x.fillStyle='rgba(255,255,255,.35)';x.fillRect(left+60,cy-h*.32,right-left-70,14);x.fillRect(left+10,cy-h*.4,30,16)}});LW=1}
function bumper(cx,cy,r,lit,col){x.save();x.translate(cx,cy);const s=1+lit*.25;x.scale(s,s);if(lit>0){x.globalAlpha=lit;x.fillStyle=col;x.beginPath();x.arc(0,0,r*1.6,0,TAU);x.fill();x.globalAlpha=1}
 LW=1.3;sticker(()=>{circ(0,0,r,lit>.3?'#ffffff':col);circ(0,0,r*.7,'#2a1a4a');sh(lit>.3?col:'#ffe14a',()=>star5(0,0,r*.55,r*.24))});LW=1;x.restore()}
function barrel(cx,cy,s,rot){x.save();x.translate(cx,cy);x.rotate(rot);x.scale(s,s);LW=1.2/s;sticker(()=>{sh('#a5612a',()=>{x.moveTo(-34,-42);x.quadraticCurveTo(-44,0,-34,42);x.lineTo(34,42);x.quadraticCurveTo(44,0,34,-42);x.closePath()});rr(-40,-26,80,9,3,'#4a4a52');rr(-40,17,80,9,3,'#4a4a52');inkLine(()=>{x.moveTo(-12,-40);x.lineTo(-14,40);x.moveTo(12,-40);x.lineTo(14,40)},2.5)});LW=1;x.restore()}
function spring(cx,base,comp){const h=110*(1-comp*.55);LW=1.3;sticker(()=>{rr(cx-60,base-16,120,16,4,'#e2322a');for(let i=0;i<4;i++){const y=base-16-(i+1)*h/4.4;ell(cx,y,48,10,'#c9ced8')}rr(cx-62,base-16-h,124,18,5,'#ffd23a')});LW=1}
function bobomb(cx,cy,s,t,lit){x.save();x.translate(cx,cy);x.scale(s,s);LW=1.2/s;sticker(()=>{ell(-14,26,12,7,'#f2b82a');ell(14,26,12,7,'#f2b82a');circ(0,0,30,'#22222c');rr(-6,-40,12,12,3,'#9aa4ae');ln(()=>{x.moveTo(0,-40);x.quadraticCurveTo(8,-52,4,-58)},'#d8c8a0',3);
 rr(-40,-8,10,16,3,'#c9ced8');rr(-48,-14,8,28,3,'#c9ced8');ell(10,-6,6,10,'#fff');ell(22,-6,5,9,'#fff');dot(11,-6,3,INK);dot(23,-6,2.6,INK)});LW=1;
 if(lit){x.fillStyle='#ffe14a';x.beginPath();burst(4,-60,7,12+hs(Math.floor(t*30))*8,4);x.fill()}x.restore()}
function magicPot(cx,cy,s,rot){x.save();x.translate(cx,cy);x.rotate(rot);x.scale(s,s);LW=1.2/s;sticker(()=>{sh('#2f6fe0',()=>{x.moveTo(-12,-26);x.lineTo(12,-26);x.lineTo(10,-16);x.quadraticCurveTo(30,-6,24,14);x.quadraticCurveTo(0,30,-24,14);x.quadraticCurveTo(-30,-6,-10,-16);x.closePath()});rr(-14,-32,28,8,3,'#9fd0ff');if(P){x.fillStyle='rgba(255,255,255,.6)';x.fillRect(-14,-8,6,14)}});LW=1;x.restore()}
function warpStar(cx,cy,s,rot){x.save();x.translate(cx,cy);x.rotate(rot);x.scale(s,s);LW=1.3/s;sticker(()=>{sh('#ffe14a',()=>star5(0,0,62,28));if(P){x.fillStyle='#fff8c0';x.beginPath();star5(-6,-6,28,12);x.fill()}});LW=1;x.restore()}
function torch(cx,cy,t){LW=1.2;sticker(()=>{rr(cx-12,cy,24,70,4,'#6a4a2a');rr(cx-24,cy-12,48,18,4,'#8a8a92')});LW=1;const f=hs(Math.floor(t*20)+cx);x.fillStyle='#ff7a1a';x.beginPath();x.moveTo(cx-22,cy-12);x.quadraticCurveTo(cx-10-f*10,cy-70-f*30,cx+2,cy-110-f*20);x.quadraticCurveTo(cx+18,cy-60,cx+22,cy-12);x.fill();x.fillStyle='#ffe14a';x.beginPath();x.moveTo(cx-10,cy-12);x.quadraticCurveTo(cx,cy-60-f*20,cx+4,cy-70);x.quadraticCurveTo(cx+12,cy-40,cx+10,cy-12);x.fill();
 x.save();x.globalAlpha=.15;x.fillStyle='#ffb04a';x.beginPath();x.arc(cx,cy-40,150,0,TAU);x.fill();x.restore()}
function palm(cx,base,h,t){LW=1.3;sticker(()=>{for(let i=0;i<6;i++){const y=base-i*h/6;rr(cx-14+i*3,y-h/6-2,28,h/6+4,6,i%2?'#9a5a2a':'#c47a3a')}const tx=cx+18,ty=base-h;for(let i=0;i<5;i++){const a=-2.9+i*.62+Math.sin(t*2+i)*.05;sh('#3fbf3a',()=>{x.moveTo(tx,ty);x.quadraticCurveTo(tx+Math.cos(a-.3)*90,ty+Math.sin(a-.3)*90-30,tx+Math.cos(a)*150,ty+Math.sin(a)*150+30);x.quadraticCurveTo(tx+Math.cos(a+.3)*80,ty+Math.sin(a+.3)*80,tx,ty)})}});LW=1}
// ---- WORLD 1: Mushroom Hill (Green Hill checkered cliffs + loop + Mario blocks) ----
const LOOP={x:770,y:880,R:225};
function bgMushroom(cam,lt){x.fillStyle=grad(0,GY,['#2f8ff0','#7cc8ff','#c8f0ff']);x.fillRect(0,0,W,GY);
 x.fillStyle='#fff6b0';x.beginPath();x.arc(860,330,70,0,TAU);x.fill();
 for(let i=0;i<4;i++)cloud(wrap(i*360-cam*.08-lt*12,1440)-180,340+i*90+(i%2)*60,.8+(i%3)*.15);
 // far checkered cliffs
 for(let i=0;i<5;i++){const cx=wrap(i*300-cam*.25,1500)-210,h=330+(i*97%4)*70,top=GY-140-h;LW=1.5;
  sticker(()=>{rr(cx,top,240,h+200,26,'#c4682a')});checker(cx+6,top+40,228,h+150,46,'#c4682a','#8e4416',cx);LW=1.5;sticker(()=>{sh('#3fbf3a',()=>{x.moveTo(cx-6,top+46);for(let k=0;k<=8;k++)x.quadraticCurveTo(cx+k*31-15,top-6,cx+k*31,top+20);x.lineTo(cx+246,top+46);x.closePath()})});LW=1}
 // loop-de-loop
 const lx=LOOP.x-cam*.4,ly=LOOP.y,R=LOOP.R;LW=1.6;sticker(()=>{rr(lx-150,ly+R-40,300,GY-ly-R+120,20,'#c4682a');sh('#3fbf3a',()=>{x.arc(lx,ly,R+44,0,TAU);x.moveTo(lx+R-10,ly);x.arc(lx,ly,R-10,0,TAU,true)})});
 x.save();x.beginPath();x.arc(lx,ly,R+30,0,TAU);x.arc(lx,ly,R-10,0,TAU,true);x.clip('evenodd');for(let i=0;i<24;i++){x.fillStyle=i%2?'#c4682a':'#8e4416';x.beginPath();x.moveTo(lx,ly);x.arc(lx,ly,R+31,i*TAU/24,(i+1)*TAU/24);x.fill()}x.restore();
 x.strokeStyle=INK;x.lineWidth=6;x.beginPath();x.arc(lx,ly,R-10,0,TAU);x.stroke();x.beginPath();x.arc(lx,ly,R+30,0,TAU);x.stroke();LW=1;
 checker(lx-144,ly+R+30,288,GY-ly-R+20,46,'#c4682a','#8e4416',lx);
 palm(wrap(120-cam*.6,1300)-100,GY-60,330,lt);palm(wrap(1000-cam*.6,1300)-100,GY-40,260,lt+1);
 // ground
 x.fillStyle='#8e4416';x.fillRect(0,GY,W,H-GY);checker(0,GY+40,W,H-GY,70,'#c4682a','#8e4416',-cam);
 LW=1.6;sticker(()=>{sh('#3fbf3a',()=>{x.moveTo(-20,GY+56);for(let k=0;k<=24;k++){const xx=k*48-wrap(cam,48);x.quadraticCurveTo(xx-24,GY-22,xx,GY+12)}x.lineTo(W+20,GY+56);x.closePath()})});LW=1;
 for(let i=0;i<3;i++){const fx=wrap(i*430+200-cam,1290)-100;LW=1.2;sticker(()=>{rr(fx-5,GY-70,10,70,4,'#3f9f3a');for(let k=0;k<8;k++){const a=k*TAU/8+lt*1.5;circ(fx+Math.cos(a)*20,GY-80+Math.sin(a)*20,11,'#ffd23a')}circ(fx,GY-80,13,'#8e4416')});LW=1}}
// ---- WORLD 2: Hyrule Casino (castle walls + Casino Night bumpers & neon) ----
const BUMP=[[190,560],[540,470],[890,580],[300,840],[780,830],[540,1060]];
function neon(path,col,w=8){x.save();x.strokeStyle=col;x.globalAlpha=.35;x.lineWidth=w*3.2;x.lineCap='round';x.beginPath();path();x.stroke();x.globalAlpha=1;x.lineWidth=w;x.stroke();x.strokeStyle='#fff';x.lineWidth=w*.35;x.stroke();x.restore()}
function bgCasino(cam,lt,lit){x.fillStyle=grad(0,GY,['#120a32','#3a1468','#7a2a8a']);x.fillRect(0,0,W,GY);
 for(let i=0;i<40;i++){const sx=wrap(hs(i)*1400-cam*.05,1200)-60,sy=hs(i+9)*800+60;x.fillStyle=`rgba(255,255,255,${.4+.6*Math.abs(Math.sin(lt*2+i))})`;x.fillRect(sx,sy,4,4)}
 // castle
 const cx=-cam*.3;LW=1.5;sticker(()=>{
  rr(cx+60,620,960,GY-560,0,'#8f8aa6');
  for(const tx of [60,430,780]){rr(cx+tx,420,240,GY-360,0,'#a39fbb');sh('#3a4a9c',()=>{x.moveTo(cx+tx-20,430);x.lineTo(cx+tx+120,210);x.lineTo(cx+tx+260,430);x.closePath()})}
 });
 x.fillStyle='rgba(40,30,70,.25)';for(let r=0;r<16;r++)for(let c=0;c<14;c++){if((r+c)%2)x.fillRect(cx+60+c*70+(r%2)*35,640+r*46,64,40)}
 for(const tx of [60,430,780]){for(let k=0;k<4;k++){x.fillStyle='#8f8aa6';x.fillRect(cx+tx+k*62,400,40,24)}x.fillStyle='#1a1030';rr(cx+tx+95,520,50,80,25,'#ffd86a');
  LW=1.2;sticker(()=>{poly([cx+tx+70,640,cx+tx+170,640,cx+tx+170,820,cx+tx+120,780,cx+tx+70,820],'#2a6a3a')});LW=1;
  if(P){x.fillStyle='#ffd23a';const bx=cx+tx+120,by=690;x.beginPath();x.moveTo(bx,by-34);x.lineTo(bx+30,by+18);x.lineTo(bx-30,by+18);x.closePath();x.fill();x.fillStyle='#2a6a3a';x.beginPath();x.moveTo(bx,by+18);x.lineTo(bx+15,by-8);x.lineTo(bx-15,by-8);x.closePath();x.fill()}}
 LW=1;
 // neon lines + sign
 const hue=['#ff4fd8','#3ff0ff','#ffe14a'];
 neon(()=>{x.moveTo(cx+60,616);x.lineTo(cx+1020,616)},hue[Math.floor(lt*3)%3],8);
 neon(()=>{x.moveTo(cx+80,1180);x.lineTo(cx+1000,1180)},hue[(Math.floor(lt*3)+1)%3],7);
 x.save();x.translate(cx+540,300);x.rotate(-.04);LW=1.4;sticker(()=>rr(-210,-56,420,112,20,'#2a0a4a'));LW=1;
 for(let i=0;i<22;i++){const a=i/22;const bx=-200+a*400;x.fillStyle=(i+Math.floor(lt*8))%2?'#ffe14a':'#ff4fd8';x.beginPath();x.arc(bx,-50,6,0,TAU);x.arc(bx,50,6,0,TAU);x.fill()}
 x.font=`900 72px ${FONT}`;x.textAlign='center';x.textBaseline='middle';x.shadowColor='#ff4fd8';x.shadowBlur=24;x.fillStyle='#ffd0f4';x.fillText('CASINO',0,4);x.shadowBlur=0;x.restore();
 // bumpers
 BUMP.forEach((b,i)=>bumper(b[0]-cam*.3,b[1],62,lit?lit[i]:0,i%2?'#3ff0ff':'#ff4fd8'));
 // floor
 x.fillStyle='#1c0e3a';x.fillRect(0,GY,W,H-GY);checker(0,GY+30,W,H-GY,90,'#2a1458','#3c1e7a',-cam);
 x.fillStyle='#ff4fd8';x.fillRect(0,GY,W,10);neon(()=>{x.moveTo(0,GY+30);x.lineTo(W,GY+30)},'#3ff0ff',5);
 for(let i=0;i<8;i++){const sx=wrap(i*160-cam,1280)-100;x.fillStyle=(i+Math.floor(lt*6))%2?'#ffe14a':'#ff4fd8';x.beginPath();x.arc(sx,GY+80,9,0,TAU);x.fill()}}
// ---- WORLD 3: Chemical Jungle (DK vines + Chemical Plant goo pipes) ----
function tube(path,lt,w=70){x.save();x.lineCap='round';x.lineJoin='round';x.strokeStyle='#fff';x.lineWidth=w+18;x.beginPath();path();x.stroke();x.strokeStyle=INK;x.lineWidth=w+8;x.stroke();x.strokeStyle='#cdeefe';x.lineWidth=w;x.stroke();x.strokeStyle='#b03adf';x.lineWidth=w*.55;x.stroke();
 x.setLineDash([18,26]);x.lineDashOffset=-lt*160;x.strokeStyle='#e9a4ff';x.lineWidth=w*.22;x.stroke();x.setLineDash([]);x.strokeStyle='rgba(255,255,255,.7)';x.lineWidth=6;x.translate(0,-w*.3);x.stroke();x.restore()}
function bgJungle(cam,lt){x.fillStyle=grad(0,GY,['#0f3a24','#2a7a3a','#8acb5a']);x.fillRect(0,0,W,GY);
 for(let L=0;L<3;L++){const k=.1+L*.2,col=['#174a2a','#1f6232','#2a7a3a'][L];for(let i=0;i<7;i++){const bx=wrap(i*230-cam*k,1610)-260,by=GY-300-L*-120-(i*53%3)*80;LW=1.4;sticker(()=>{sh(col,()=>{x.ellipse(bx,by,150,110,0,0,TAU)});rr(bx-20,by,40,GY-by+40,8,'#5a3a1e')});LW=1}}
 tube(()=>{x.moveTo(-60-cam*.35,760);x.lineTo(300-cam*.35,760);x.arc(300-cam*.35,900,140,-Math.PI/2,Math.PI/2);x.lineTo(-60-cam*.35,1040)},lt);
 tube(()=>{x.moveTo(1150-cam*.35,560);x.lineTo(700-cam*.35,560);x.quadraticCurveTo(560-cam*.35,560,560-cam*.35,700);x.lineTo(560-cam*.35,GY+40)},lt+1,60);
 for(let i=0;i<6;i++){const vx=wrap(i*210+80-cam*.7,1260)-90,len=300+(i*71%4)*90,sw=Math.sin(lt*1.6+i)*24;
  ln(()=>{x.moveTo(vx,-20);x.quadraticCurveTo(vx+sw,len*.5,vx+sw*1.6,len)},'#3f9f2a',9);
  for(let k=1;k<5;k++){const ly=len*k/5,lx=vx+sw*1.6*(k/5);LW=1;sticker(()=>ell(lx+12,ly,16,8,'#4fbf3a',.5));LW=1}}
 x.fillStyle='#4a2e16';x.fillRect(0,GY,W,H-GY);
 for(let i=0;i<14;i++){const px=wrap(i*95-cam,1330)-120;x.fillStyle=i%2?'#5a3a1e':'#3e2610';x.fillRect(px,GY+40,90,H-GY)}
 LW=1.5;sticker(()=>{sh('#5aa83a',()=>{x.moveTo(-20,GY+40);for(let k=0;k<=22;k++){const xx=k*52-wrap(cam,52);x.lineTo(xx-26,GY-14);x.lineTo(xx,GY+10)}x.lineTo(W+20,GY+40);x.closePath()})});
 const gx=wrap(700-cam,1500)-200;sticker(()=>ell(gx,GY+150,260,46,'#b03adf'));LW=1;
 for(let i=0;i<5;i++){const k=(lt*.7+i/5)%1;x.fillStyle='rgba(240,190,255,.8)';x.beginPath();x.arc(gx-180+i*90,GY+150-k*50,8+k*8,0,TAU);x.fill()}
 barrel(wrap(120-cam,1400)-100,GY+120,1.1,.1)}
// ---- WORLD 4: Streets of Dream Land (Streets of Rage night city + Kirby stars) ----
function bgStreets(cam,lt){x.fillStyle=grad(0,GY,['#0b0626','#2a1650','#7a2a6a']);x.fillRect(0,0,W,GY);
 // dream land stars + smiling moon
 for(let i=0;i<14;i++){const sx=wrap(hs(i*3)*1300-cam*.05,1200)-60,sy=hs(i*5)*640+260,r=10+hs(i)*16,tw=.6+.4*Math.sin(lt*3+i);x.save();x.globalAlpha=tw;x.fillStyle='#ffe14a';x.strokeStyle=INK;x.lineWidth=3;x.beginPath();star5(sx,sy,r,r*.45,lt*.5+i);x.fill();x.stroke();x.restore()}
 x.save();x.translate(840-cam*.05,380);LW=1.5;sticker(()=>{sh('#fff2a8',()=>{x.arc(0,0,80,-1.2,1.9);x.quadraticCurveTo(-10,10,Math.cos(-1.2)*80,Math.sin(-1.2)*80)})});LW=1;dot(30,-8,6,INK);x.restore();
 // buildings
 for(let L=0;L<2;L++){const k=L?.5:.22;for(let i=0;i<7;i++){const bx=wrap(i*200-cam*k,1400)-160,bh=L?(380+(i*73%5)*80):(560+(i*37%4)*90),bw=L?170:190,top=GY-bh;LW=1.5;
  sticker(()=>rr(bx,top,bw,bh+60,6,L?'#3a2466':'#261848'));LW=1;
  if(L){for(let r=0;r<Math.floor(bh/70);r++)for(let q=0;q<3;q++){if(hs(i*31+r*7+q)>.35){x.fillStyle=['#ffd36b','#7ae0ff','#ff7ad8'][(i+r+q)%3];x.fillRect(bx+18+q*50,top+24+r*70,32,38)}}
   if(i%3==0){const nx=bx+bw/2,ny=top+60;x.save();x.shadowColor='#ff4fd8';x.shadowBlur=18;x.fillStyle=Math.floor(lt*4+i)%5?'#ff9af0':'#ff4fd8';x.font=`900 46px ${FONT}`;x.textAlign='center';x.fillText(['BAR','DREAM','24H'][i%3==0?(i/3)%3:0],nx,ny);x.restore()}}}}
 // lamp
 const lx=wrap(900-cam*.9,1300)-100;LW=1.3;sticker(()=>{rr(lx-8,GY-520,16,520,6,'#3a3a48');rr(lx-60,GY-540,80,22,8,'#3a3a48')});LW=1;x.save();x.globalAlpha=.25;x.fillStyle='#ffe9a0';x.beginPath();x.moveTo(lx-50,GY-520);x.lineTo(lx-180,GY);x.lineTo(lx+80,GY);x.lineTo(lx-10,GY-520);x.fill();x.restore();
 // street
 x.fillStyle='#24203a';x.fillRect(0,GY,W,H-GY);x.fillStyle='#4a4462';x.fillRect(0,GY,W,40);x.fillStyle='#16132a';x.fillRect(0,GY+40,W,8);
 for(let i=0;i<8;i++){const sx=wrap(i*180-cam,1440)-180;x.fillStyle='#ffd23a';x.fillRect(sx,GY+200,100,16)}
 for(let i=0;i<10;i++){const sx=wrap(i*120-cam,1200)-60;x.fillStyle='#3a3456';x.fillRect(sx,GY,6,40)}}
// ---- WORLD 5: Zebes Golden Axe (Metroid caverns + Golden Axe ruins & torches) ----
function bgZebes(cam,lt){x.fillStyle=grad(0,GY,['#081420','#12304a','#1e4a5a']);x.fillRect(0,0,W,GY);
 for(let i=0;i<26;i++){const bx=wrap(hs(i)*1500-cam*.15,1400)-160,by=hs(i+3)*1100+60,r=30+hs(i+7)*70;LW=1.2;sticker(()=>{circ(bx,by,r,'#1d3e54');circ(bx-r*.3,by-r*.3,r*.35,'#2a5a70')});LW=1}
 LW=1.4;sticker(()=>{for(let i=0;i<8;i++){const sx=wrap(i*170-cam*.3,1360)-140;poly([sx,-20,sx+120,-20,sx+60,140+(i*41%3)*70],'#24485e')}});LW=1;
 // ruins
 const rx=-cam*.45;LW=1.5;
 for(const [cx2,h,broken] of [[120,700,0],[440,520,1],[760,760,0],[1010,430,1]]){const X=rx+cx2,top=GY-h;sticker(()=>{rr(X-62,top,124,h+40,4,'#8a7a62');rr(X-84,top-30,168,40,6,'#a89878');if(broken)poly([X-84,top-30,X-30,top-70,X+10,top-36,X+60,top-80,X+84,top-30],'#a89878');rr(X-84,GY-60,168,60,6,'#a89878')});
  inkLine(()=>{for(let k=1;k<h/90;k++){x.moveTo(X-62,top+k*90);x.lineTo(X+62,top+k*90)}x.moveTo(X-30,top);x.lineTo(X-30,GY-60);x.moveTo(X+30,top);x.lineTo(X+30,GY-60)},2.5)}
 sticker(()=>{sh('#a89878',()=>{x.moveTo(rx+120,GY-700);x.quadraticCurveTo(rx+290,GY-900,rx+440,GY-560);x.lineTo(rx+400,GY-540);x.quadraticCurveTo(rx+290,GY-820,rx+160,GY-680);x.closePath()})});LW=1;
 torch(rx+280,GY-560,lt);torch(rx+900,GY-520,lt+.5);
 // floor
 x.fillStyle='#3a3230';x.fillRect(0,GY,W,H-GY);for(let r=0;r<6;r++)for(let i=0;i<10;i++){const bx=wrap(i*140+(r%2)*70-cam,1400)-140;LW=1;x.fillStyle=(i+r)%3?'#5a5048':'#4a423c';x.fillRect(bx+4,GY+r*90+4,132,82)}
 x.fillStyle='#7ad0e0';x.fillRect(0,GY,W,8);x.save();x.globalAlpha=.15;x.fillStyle='#ff6a2a';x.fillRect(0,H-160,W,160);x.restore()}
const BGS=[bgMushroom,bgCasino,bgJungle,bgStreets,bgZebes];
