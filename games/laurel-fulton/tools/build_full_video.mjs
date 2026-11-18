// build_full_video.mjs — Full-length 1080x1920 portrait video of Scaggsville (games/laurel-fulton/)
// with REAL captured game WebAudio (MediaRecorder teeing AudioContext.destination + canvas.captureStream).
// Any length — lets every beat breathe: all 5 house cutaways (Brad, Rigg, Jason, Kosack, Floyds),
// Lazaris & Grant door beats, convoy racing/passing/throws, Weis (15s), Gringada (14s), 108 Astro,
// Kosack Fake-Cop (real siren), Cops/Wanted + Helicopter, Night Party at Floyds' (outdoor + lower level),
// Park It! + KOTH, and Atholton arrival + Lamar's burning Mustang.
//
// Usage: node tools/build_full_video.mjs
// Output: games/laurel-fulton/shots/scaggsville-full.mp4
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { chromium } from '../../palm-city/tools/node_modules/playwright-core/index.mjs';

const ROOT = path.resolve('..');
const LF = path.join(ROOT, 'laurel-fulton');
const TMP = path.join(LF, 'shots', '_full_vid_tmp');
const OUT_MP4 = path.join(LF, 'shots', 'scaggsville-full.mp4');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css',
};
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); r.end(); }
    else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }
  });
});
await new Promise(r => srv.listen(0, r));
const PORT = srv.address().port;
const BASE = `http://localhost:${PORT}/laurel-fulton/index.html`;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

// Inject WebAudio tee + MediaRecorder helper on every page
const INIT_RECORDER = () => {
  window.__audioDests = [];
  window.__acList = [];
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const res = origConnect.call(this, dest, ...rest);
    try {
      if (this.context && dest === this.context.destination) {
        if (!this.context.__recDest) {
          this.context.__recDest = this.context.createMediaStreamDestination();
          window.__audioDests.push(this.context.__recDest);
          window.__acList.push(this.context);
        }
        origConnect.call(this, this.context.__recDest);
      }
    } catch (_) {}
    return res;
  };

  window.__setCaption = (cap) => {
    let el = document.getElementById('__vid_cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__vid_cap';
      el.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);background:rgba(27,20,48,0.88);color:#ffd25c;border:2px solid #ffd25c;border-radius:12px;padding:5px 13px;font:900 13px system-ui,sans-serif;letter-spacing:0.4px;white-space:nowrap;z-index:9999;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = cap || '';
    el.style.display = cap ? 'block' : 'none';
  };

  window.__startRec = () => {
    const cv = document.getElementById('game');
    const stream = cv.captureStream(24);
    for (const d of window.__audioDests) {
      for (const tr of d.stream.getAudioTracks()) stream.addTrack(tr);
    }
    // Keep a silent fallback audio track so every segment has an audio stream for clean ffmpeg concat
    if (stream.getAudioTracks().length === 0) {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator(), g = ac.createGain(), d = ac.createMediaStreamDestination();
      g.gain.value = 0.0001; osc.connect(g); g.connect(d); osc.start();
      for (const tr of d.stream.getAudioTracks()) stream.addTrack(tr);
    }
    window.__recChunks = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    window.__rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4500000 });
    window.__rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) window.__recChunks.push(e.data); };
    window.__rec.start(250);
  };

  window.__stopRec = () => new Promise((resolve) => {
    if (!window.__rec || window.__rec.state === 'inactive') return resolve('');
    window.__rec.onstop = async () => {
      const blob = new Blob(window.__recChunks, { type: window.__rec.mimeType });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      resolve(btoa(bin));
    };
    window.__rec.stop();
  });
};

let segIdx = 0;
const segFiles = [];

async function openPage(query = '') {
  const p = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await p.addInitScript(INIT_RECORDER);
  await p.goto(BASE + query);
  await p.waitForFunction(() => window.__lf && window.__lf.sim && window.__lf.areas && window.__lf.areas.heroes.length > 0, null, { timeout: 60000 });
  await p.mouse.click(10, 10).catch(() => {});
  return p;
}

async function recordSegment(p, name, fn) {
  console.log(`Recording [${name}]...`);
  await p.evaluate(() => window.__startRec());
  await fn();
  const b64 = await p.evaluate(() => window.__stopRec());
  if (b64) {
    const outWebm = path.join(TMP, `seg_${String(segIdx++).padStart(2, '0')}_${name}.webm`);
    fs.writeFileSync(outWebm, Buffer.from(b64, 'base64'));
    segFiles.push(outWebm);
    console.log(`  -> saved ${path.basename(outWebm)} (${(fs.statSync(outWebm).size / 1024).toFixed(0)} KB)`);
  }
}

async function walkInsideTo(p, targetX) {
  const curX = await p.evaluate(() => window.__lf.inside()?.hero?.x ?? 0);
  const key = curX < targetX ? 'ArrowRight' : 'ArrowLeft';
  await p.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const x = await p.evaluate(() => window.__lf.inside()?.hero?.x ?? null);
    if (x === null || Math.abs(x - targetX) < 0.35) break;
    await p.waitForTimeout(30);
  }
  await p.keyboard.up(key);
}

try {
  // 1. PICK SCREEN + BRAD'S HOUSE CUTAWAY (Teter + fireplace + eDonkey basement PC)
  let p = await openPage('?nointro');
  await recordSegment(p, '01_pick_and_brad', async () => {
    await p.waitForTimeout(1800);
    await p.evaluate(() => window.__lf.pick('brad'));
    await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 15000 });
    await p.waitForTimeout(2600);
    // Walk down to Brad's lower level (eDonkey PC + fireplace + cooler)
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown');
      await p.waitForTimeout(1200);
      await p.keyboard.up('ArrowDown');
      await walkInsideTo(p, 4.0);
      await p.waitForTimeout(1800);
    }
  });
  await p.close();

  // 2. KOSACK'S 3-LEVEL HOUSE CUTAWAY ("Chinese food is here." -> "watch wang wash wang." -> "shut up." -> basement arcade/bar/hole)
  p = await openPage('?player=kosack&nointro');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '02_kosack_house', async () => {
    await p.waitForTimeout(6800); // full 3-line bark exchange
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown');
      await p.waitForTimeout(1200);
      await p.keyboard.up('ArrowDown');
      await p.waitForTimeout(1200);
      await walkInsideTo(p, 10.5); // pan past arcade + bar + giant hole in wall
      await p.waitForTimeout(1500);
    }
  });
  await p.close();

  // 3. JASON'S HOUSE CUTAWAY (giant speakers + cheeseburger-teacher pic + basement Genesis Holyfield boxing)
  p = await openPage('?player=jason&nointro');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '03_jason_house', async () => {
    await p.waitForTimeout(2200);
    await walkInsideTo(p, 8.5);
    await p.waitForTimeout(1200);
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown');
      await p.waitForTimeout(1200);
      await p.keyboard.up('ArrowDown');
      await p.waitForTimeout(2400);
    }
  });
  await p.close();

  // 4. THE FLOYDS' SPLIT-FOYER (Mom butter churner upstairs + Dad gaming by fireplace downstairs)
  p = await openPage('?player=clayton&nointro');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '04_floyds_house', async () => {
    await p.waitForTimeout(2800);
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown');
      await p.waitForTimeout(1200);
      await p.keyboard.up('ArrowDown');
      await p.waitForTimeout(2600);
    }
  });
  await p.close();

  // 5. RIGG'S HOUSE ("Brrrrrriiiiiiaaaaannnn" + son down stairs) + SCOOBY VAN OUTSIDE
  p = await openPage('?player=rigg&nointro');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '05_rigg_house_and_van', async () => {
    await p.waitForTimeout(4800); // wait for dad yell + Rigg-ism + stairs
    // Exit house onto front walk & pan to Scooby van (wait for ground chunks!)
    await p.keyboard.down('ArrowLeft');
    await p.waitForTimeout(1400);
    await p.keyboard.up('ArrowLeft');
    await p.keyboard.press('Space'); // EXIT
    await p.waitForTimeout(800);
    await p.evaluate(() => {
      const L = window.__lf, v = L.van();
      if (v && L.foot()) { L.foot().x = v.x - 10; L.foot().y = v.y + 22; L.cam.x = v.x; L.cam.y = v.y; }
    });
    await p.waitForTimeout(2400);
  });
  await p.close();

  // 6. WEIS MARKET CUTAWAY (Full ~16s soda firing beat -> "Fuck Scott." + Brad pizza counter)
  p = await openPage('?player=jason&nointro');
  await p.waitForFunction(() => window.__lf.places(), null, { timeout: 20000 });
  await p.evaluate(() => {
    const L = window.__lf, weis = L.places().place('weis');
    L.goInPlace(weis, L.foot().who);
  });
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 15000 });
  await recordSegment(p, '06_weis_full', async () => {
    await p.waitForTimeout(1200);
    await walkInsideTo(p, 4.6);  // Jason security desk
    await p.waitForTimeout(800);
    await walkInsideTo(p, 23.5); // Triggers THE FIRING ("Fuck Scott.")
    await p.waitForTimeout(15500);
    await walkInsideTo(p, 39.5); // Brad pizza counter
    await p.keyboard.press('Space');
    await p.waitForTimeout(1500);
  });

  // 7. GRINGADA 1998 CUTAWAY (Full ~14.5s steal beat -> "why are you going to Clayton it")
  await p.evaluate(() => {
    const L = window.__lf, gring = L.places().place('gringada');
    L.goInPlace(gring, L.foot().who);
  });
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 15000 });
  await recordSegment(p, '07_gringada_full', async () => {
    await p.waitForTimeout(1200);
    await walkInsideTo(p, 15.5); // Triggers THE STEAL
    await p.waitForTimeout(14500);
  });
  await p.close();

  // 8. DOOR BEATS (Lazaris boots-in-yard + Grant's mom "move your car") + CONVOY MISCHIEF
  for (const [who, targetId, segName] of [['rigg', 'jimmy', '08a_lazaris_door'], ['brad', 'grant', '08b_grant_door']]) {
    p = await openPage(`?pilot&player=${who}&speed=16`);
    await p.waitForFunction((tid) => {
      const M = window.__lf.mission();
      return M && M.beat && M.beat.stop && M.beat.stop.people.some(q => q.id === tid);
    }, targetId, { timeout: 180000, polling: 40 });
    await p.evaluate(() => window.__lf.setSpeed(1));
    await recordSegment(p, segName, async () => {
      await p.waitForTimeout(6500); // full arrival beat + dap + door lines!
    });
    await p.close();
  }

  // 9. ROUTE 108 ASTRO + KOSACK FAKE-COP (REAL SIREN AUDIO!) + WANTED COP CHASE + NIGHT PARTY AT FLOYDS'
  p = await openPage('?player=kosack&nointro');
  await recordSegment(p, '09_astro_fakecop_cops', async () => {
    // Route 108 Astro
    await p.evaluate(() => {
      const L = window.__lf, astro = L.places().astro(L.sim);
      if (astro) { L.jumpTo({ pos: [astro.x, astro.y] }); L.cam.x = astro.x; L.cam.y = astro.y; L.places().bark = { x: astro.x, y: astro.y - 36, t: 3.5, text: 'Parking lights. Mine now.' }; }
    });
    await p.waitForTimeout(2800);

    // Kosack Fake-Cop Pull-Over with REAL Siren Audio
    await p.evaluate(() => {
      const L = window.__lf;
      L.jumpTo({ pos: L.sim.roster.people.find(q => q.id === 'kosack').house, carModel: 'cavalier_kosack' });
      const P = L.sim.player, fc = L.fakeCop();
      const m = fc.models[0] || Object.keys(L.sim.fleet)[0];
      const tc = L.sim.addCar(m, P.x + Math.cos(P.h) * 85, P.y + Math.sin(P.h) * 85, P.h, {
        traffic: true, fcState: 'NONE', fcT: 0, fcCd: 0, driveFn: (c, dt) => fc._driveTraffic(c, dt),
      });
      fc.traffic.push(tc);
      fc.triggerSiren(true);
    });
    await p.keyboard.down('KeyH');
    await p.waitForTimeout(6500); // let full pull-over + "...wait. KOSACK?!" / toast play out!
    await p.keyboard.up('KeyH');
    await p.evaluate(() => window.__lf.fakeCop().triggerSiren(false));

    // Wanted Chase (Cops + Siren + Helicopter)
    await p.evaluate(() => {
      const L = window.__lf, C = L.cops;
      if (C && C.addHeat) C.addHeat(3);
    });
    await p.keyboard.down('ArrowUp');
    await p.waitForTimeout(5500);
    await p.keyboard.up('ArrowUp');
  });

  // 10. FLOYDS' NIGHT PARTY (100 guests + continuous streetlamps) + PARK IT! + KOTH + ATHOLTON FINALE
  await recordSegment(p, '10_floyds_party_minigames_finale', async () => {
    await p.evaluate(() => {
      const L = window.__lf;
      const floyds = L.sim.roster.people.find(q => q.id === 'clayton').house;
      L.party().setVenue('floyds');
      L.jumpTo({ pos: floyds, night: true });
    });
    await p.waitForTimeout(4500);

    // Park It! live drive into Ledo bay
    await p.evaluate(() => {
      const L = window.__lf, b = L.valet().bays[0], P = L.sim.player;
      L.jumpTo({ pos: [b.x - 80, b.y] });
      P.x = b.x - 80; P.y = b.y; P.h = b.h; P.v = 110;
    });
    await p.waitForTimeout(3200);

    // KOTH cul-de-sac
    await p.evaluate(() => {
      const L = window.__lf, K = L.koth();
      if (K && K.sacs?.length) { L.jumpTo({ pos: [K.sacs[0].x, K.sacs[0].y] }); K.tryStart(L.sim); }
    });
    await p.waitForTimeout(4500);

    // Atholton Finale: Lamar's burning Mustang (dark smoke + ember glow)
    await p.evaluate(() => {
      const L = window.__lf, lamar = L.sim.cars.find(c => c.owner === 'lamar');
      if (lamar) { L.jumpTo({ pos: [lamar.x, lamar.y] }); L.cam.x = lamar.x; L.cam.y = lamar.y; }
    });
    await p.waitForTimeout(4000);
  });
  await p.close();
} finally {
  await browser.close();
  srv.close();
}

// Transcode each WebM to uniform 1080x1920 24fps H.264+AAC MP4 and concat cleanly
const mp4Parts = [];
for (const wf of segFiles) {
  const mp = wf.replace(/\.webm$/, '.mp4');
  execFileSync('ffmpeg', [
    '-y', '-i', wf,
    '-vf', 'scale=1080:1920:flags=lanczos,fps=24,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k',
    '-shortest', mp,
  ], { stdio: 'ignore' });
  mp4Parts.push(mp);
}
const listTxt = path.join(TMP, 'concat.txt');
fs.writeFileSync(listTxt, mp4Parts.map(f => `file '${f}'`).join('\n'));
execFileSync('ffmpeg', [
  '-y', '-f', 'concat', '-safe', '0', '-i', listTxt,
  '-c', 'copy', '-movflags', '+faststart',
  OUT_MP4,
], { stdio: 'inherit' });
fs.rmSync(TMP, { recursive: true, force: true });
console.log('FULL VIDEO READY:', OUT_MP4);
