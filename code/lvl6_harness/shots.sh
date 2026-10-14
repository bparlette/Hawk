A='(()=>{const S=__SS.STATE,p=S.player;p.x=240;p.y=194;const H=S.haz;H[1].st.cd=1;H[2].st.list.push({x:200,y:178,t:34});H[2].st.list.push({x:300,y:205,t:60});S.enemies.forEach((e,i)=>{e.x=120+i*90;});})()'
node shot.js "&level=6&nocache" "$A" shot_gameplay.png 380
B='(()=>{const S=__SS.STATE,p=S.player;p.x=80;p.y=200;const st=S.haz[3].st;st.ph="go";st.t=10;st.x=120;st.dir=1;st.hit=new Set();st.y=184;S.haz[3].h.update=null;})()'
node shot.js "&level=6&nocache" "$B" shot_hazard_plow.png 300
B2='(()=>{const S=__SS.STATE,p=S.player;const st=S.haz[3].st;st.ph="warn";st.t=60;st.dir=-1;st.y=p.y;S.haz[3].h.update=null;})()'
node shot.js "&level=6&nocache" "$B2" shot_hazard_warn.png 120
C='(()=>{const S=__SS.STATE;window.__iv=setInterval(()=>{const p=S.player;if(!p)return;p.hp=16;if(S.sec===0){S.enemies.forEach(e=>{e.hp=0;e.state="dying";e.t=80;});S.queue=[];p.x=Math.min(p.x+60,S.camX+372);}else{const e=S.enemies.find(e=>e.boss);if(e&&e.state==="walk"&&!window.__f){window.__f=1;p.x=110;p.y=190;e.x=250;e.y=190;e.facing=-1;e.state="spray";e.t=40;e.cool=999;clearInterval(window.__iv);}}},120);})()'
W8=3600 node shot.js "&level=6&nocache" "$C" shot_boss.png 9000
