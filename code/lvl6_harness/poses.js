const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1152, height: 900 } });
  let errs=0;
  pg.on('pageerror', e => { errs++; console.log('PAGEERROR', e.message); });
  pg.on('console', m => { if (m.type() === 'error') { errs++; console.log('CONSOLE', m.text()); } });
  await pg.goto('file:///workspace/work/lvl6_test/index.html?debug&level=6&nocache');
  await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(400); await pg.keyboard.press('Enter'); await pg.waitForTimeout(3600);
  // skip to boss
  await pg.evaluate(() => { const S=__SS.STATE; window.__iv=setInterval(()=>{const p=S.player;if(!p)return;p.hp=16;if(S.sec===0){S.enemies.forEach(e=>{e.hp=0;e.state="dying";e.t=80;});S.queue=[];p.x=Math.min(p.x+60,S.camX+372);}},120); });
  for (let i=0;i<120;i++){ await pg.waitForTimeout(250); const ok=await pg.evaluate(()=>{const S=__SS.STATE;return S.sec===1&&!!S.enemies.find(e=>e.boss&&e.state==="walk");}); if(ok) break; }
  await pg.evaluate(()=>clearInterval(window.__iv));
  const poses=[['idle','walk',0,0],['walk','walk',0,8],['walk2','walk',0,24],['spray_tele','spray',30,0],['spray_fire','spray',70,0],['spin','spin',20,0],['spinshards','spin',52,0],['tele','tele',4,0],['charge','charge',10,0],['kwind','kwind',5,0],['kick','kick',5,0],['throw','throw',10,0],['throw_rel','throw',16,0],['slam','slam',12,0],['summon','summon',10,0],['hurt','hurt',5,0],['down','down',5,0]];
  for (const [n,st,t,wt] of poses) {
    await pg.evaluate(([st,t,wt])=>{const S=__SS.STATE,p=S.player,e=S.enemies.find(e=>e.boss);S.enemies.filter(m=>!m.boss).forEach(m=>{m.x=-999;});p.x=S.camX+130;p.y=196;p.facing=1;p.hp=16;p.inv=0;p.hurtT=0;e.x=S.camX+235;e.y=192;e.z=0;e.facing=-1;e.state=st;e.t=t;e.walkT=wt;e.cool=999;if(st!=="spray")e.spray=0;if(st==="spray"&&t>44)e.spray=Math.min(150,(t-44)*9);S.stop=0;},[st,t,wt]);
    await pg.waitForTimeout(st==='slam'?330:st==='spin'&&t>50?250:30);
    await (await pg.$('#game')).screenshot({ path: '../lvl6_art/shots/'+n+'.png' });
  }
  // KO + outro
  await pg.evaluate(()=>{const S=__SS.STATE,e=S.enemies.find(e=>e.boss);e.inv=0;e.state="walk";e.hp=1;});
  await pg.evaluate(()=>{const S=__SS.STATE,p=S.player;p.inv=0;});
  for(let i=0;i<40;i++){ await pg.keyboard.press('j'); await pg.waitForTimeout(150); const d=await pg.evaluate(()=>{const S=__SS.STATE,e=S.enemies.find(e=>e.boss);if(e&&e.hp>1)e.hp=1; if(e){S.player.x=e.x-20;S.player.y=e.y;} return !e||e.state==="dying"||!!S.outro;}); if(d) break; }
  await pg.waitForTimeout(300); await (await pg.$('#game')).screenshot({ path: '../lvl6_art/shots/ko.png' });
  await pg.waitForTimeout(7000); await (await pg.$('#game')).screenshot({ path: '../lvl6_art/shots/outro.png' });
  console.log('errors',errs, await pg.evaluate(()=>({outro:!!__SS.STATE.outro,scene:__SS.STATE.scene})));
  await b.close();
})();
