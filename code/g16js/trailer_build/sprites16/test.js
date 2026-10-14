const { webkit } = require('/workspace/work/freeze_test/node_modules/playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8791/';
(async () => {
  const b = await webkit.launch();
  for (const vp of [{width:1280,height:900,n:'desk'},{width:390,height:844,n:'phone'}]) {
    const ctx = await b.newContext({viewport:{width:vp.width,height:vp.height}, isMobile: vp.n==='phone', hasTouch: vp.n==='phone'});
    const pg = await ctx.newPage();
    const fs=require('fs');
    await ctx.route('https://shellshock-sprites.surge.sh/**', r => { const f='/workspace/work/sprites/out'+require("url").parse(r.request().url()).pathname; fs.existsSync(f)? r.fulfill({path:f, contentType:'image/png'}) : r.fulfill({status:404}); });
    const reqs = [], errs = [];
    pg.on('request', r => reqs.push(r.url()));
    pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
    pg.on('pageerror', e => errs.push('PAGEERROR '+e.message));
    await pg.goto(URL, {waitUntil:'load'});
    await pg.waitForTimeout(4000);
    const spr = u => /sprites\.json|shellshock-sprites/.test(u);
    const initial = reqs.filter(spr).length;
    const vid = await pg.evaluate(() => { const v=document.getElementById('hv'); return {t:v.currentTime, paused:v.paused, rs:v.readyState, err:v.error&&v.error.code}; });
    const pre = await pg.evaluate(() => [...document.querySelectorAll('section.spr')].map(s=>s.id+':'+s.querySelectorAll('img').length+'imgs,'+s.innerText.length+'ch'));
    console.log(vp.n, 'initial sprite reqs', initial, 'video', JSON.stringify(vid), 'pre', pre.join(' '));
    // scroll to cast
    await pg.evaluate(() => document.getElementById('cast').scrollIntoView());
    await pg.waitForTimeout(3500);
    const c1 = await pg.evaluate(() => ({vsImgs:document.querySelectorAll('#versus img').length, cards:document.querySelectorAll('#cast .scard').length, imgs:document.querySelectorAll('#cast img').length, vs:document.querySelectorAll('#versus .scard').length, lazy:[...document.querySelectorAll('section.spr img')].every(i=>i.getAttribute('loading')==='lazy'&&i.getAttribute('decoding')==='async'), loaded:[...document.querySelectorAll('#cast img')].filter(i=>i.complete&&i.naturalWidth>0).length}));
    console.log(vp.n, 'after cast scroll', JSON.stringify(c1), 'json reqs', reqs.filter(u=>/sprites\.json/.test(u)).length, 'png reqs', reqs.filter(u=>/shellshock-sprites/.test(u)).length);
    await pg.screenshot({path:`cast_${vp.n}.png`});
    // lightbox
    await pg.click('#cast .spose');
    await pg.waitForTimeout(800);
    const lb1 = await pg.evaluate(() => document.querySelector('#slb .lcap').innerText);
    await pg.click('#slb .ln'); await pg.waitForTimeout(600);
    const lb2 = await pg.evaluate(() => document.querySelector('#slb .lcap').innerText);
    await pg.screenshot({path:`lightbox_${vp.n}.png`});
    await pg.click('#slb .lx');
    console.log(vp.n, 'lightbox', JSON.stringify(lb1), '->', JSON.stringify(lb2));
    // filter cast
    await pg.fill('#cast input', 'shredder'); await pg.waitForTimeout(1500);
    const f = await pg.evaluate(() => [...document.querySelectorAll('#cast .scard')].filter(c=>!c.hidden).map(c=>c._c.name));
    console.log(vp.n, 'filter shredder', f.join(','));
    await pg.fill('#cast input', ''); await pg.waitForTimeout(500);
    // jump button
    await pg.click('#cast .stool button:nth-child(4)'); await pg.waitForTimeout(2500);
    const top = await pg.evaluate(() => Math.round(document.getElementById('cast-enemy').getBoundingClientRect().top));
    console.log(vp.n, 'jump Enemies top', top);
    // versus
    await pg.evaluate(() => document.getElementById('versus').scrollIntoView());
    await pg.waitForTimeout(3500);
    const v1 = await pg.evaluate(() => ({cards:document.querySelectorAll('#versus .scard').length, px:[...document.querySelectorAll('#versus img.px')].length, pxStyle:getComputedStyle(document.querySelector('#versus img.px')).imageRendering, link:!!document.querySelector('#versus a[href="https://shellshock16bit.surge.sh/"]'), overflow: document.documentElement.scrollWidth>innerWidth}));
    console.log(vp.n, 'versus', JSON.stringify(v1));
    await pg.screenshot({path:`versus_${vp.n}.png`});
    await pg.fill('#versus input', 'krang'); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('versus').scrollIntoView());
    await pg.waitForTimeout(2500);
    await pg.screenshot({path:`versus_krang_${vp.n}.png`});
    const vid2 = await pg.evaluate(() => { const v=document.getElementById('hv'); return {t:v.currentTime, rs:v.readyState, err:v.error&&v.error.code}; });
    console.log(vp.n, 'video later', JSON.stringify(vid2), 'errors', JSON.stringify([...new Set(errs)]));
    await pg.evaluate(() => scrollTo(0,0)); await pg.waitForTimeout(3000);
    const vid3 = await pg.evaluate(() => { const v=document.getElementById('hv'); return {t:v.currentTime, paused:v.paused}; });
    console.log(vp.n, 'video back at top', JSON.stringify(vid3), 'total imgs in DOM', await pg.evaluate(()=>document.querySelectorAll('section.spr img').length));
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
