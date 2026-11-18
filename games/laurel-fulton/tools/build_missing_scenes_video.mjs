// build_missing_scenes_video.mjs — Records the 5 missing scenes in 1080x1920 portrait:
//   1. Jason's Basement Genesis + Holyfield Boxing PLAY spot
//   2. Rigg's Scooby-Doo Van exhaust-tip step & puff
//   3. Dedicated Multi-Car Convoy Racing (passing, "Cole Trickle!", "Rubbin is racing!", throwing $1/pens/pennies)
//   4. Floyds' Night Party Indoor Room (lower-level packed party)
//   5. Atholton HS Wall Climb -> Roof Lookout over Lamar's burning Mustang
//
// Usage: node tools/build_missing_scenes_video.mjs
// Output: games/laurel-fulton/shots/scaggsville-missing-scenes.mp4
import fs from 'fs';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { chromium } from '../../palm-city/tools/node_modules/playwright-core/index.mjs';

const ROOT = path.resolve('..');
const LF = path.join(ROOT, 'laurel-fulton');
const TMP = path.join(LF, 'shots', '_missing_vid_tmp');
const OUT_MP4 = path.join(LF, 'shots', 'scaggsville-missing-scenes.mp4');
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

const INIT_RECORDER = () => {
  window.__audioDests = [];
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const res = origConnect.call(this, dest, ...rest);
    try {
      if (this.context && dest === this.context.destination) {
        if (!this.context.__recDest) {
          this.context.__recDest = this.context.createMediaStreamDestination();
          window.__audioDests.push(this.context.__recDest);
        }
        origConnect.call(this, this.context.__recDest);
      }
    } catch (_) {}
    return res;
  };
  window.__startRec = () => {
    const cv = document.getElementById('game');
    const stream = cv.captureStream(24);
    for (const d of window.__audioDests) for (const tr of d.stream.getAudioTracks()) stream.addTrack(tr);
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
  // 1. JASON'S BASEMENT: GENESIS + HOLYFIELD BOXING PLAY SPOT
  let p = await openPage('?player=jason&nointro');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '01_jason_holyfield', async () => {
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowDown');
      const playX = await p.evaluate(() => {
        const pr = window.__lf.inside().K.props.find(q => /genesis|tv|console|arcade/i.test(q.kind || ''));
        return pr ? pr.x : 5.5;
      });
      await walkInsideTo(p, playX);
      await p.keyboard.press('Space'); // trigger PLAY
      await p.waitForTimeout(3200);
    }
  });
  await p.close();

  // 2. RIGG'S SCOOBY-DOO VAN EXHAUST TIP STEP + PUFF
  p = await openPage('?player=jason&nointro');
  await p.waitForFunction(() => window.__lf.van(), null, { timeout: 20000 });
  await recordSegment(p, '02_scooby_van_exhaust', async () => {
    await p.evaluate(() => {
      const L = window.__lf, v = L.van(), f = L.foot();
      L.jumpTo({ pos: [v.x, v.y] });
      f.active = true; f.z = 0;
      f.x = v.x - Math.cos(v.h) * 32; f.y = v.y - Math.sin(v.h) * 32;
      f.px = f.x; f.py = f.y; f.h = v.h;
      L.cam.x = v.x; L.cam.y = v.y;
    });
    await p.waitForTimeout(1400);
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowRight');
    await p.waitForTimeout(2200);
  });
  await p.close();

  // 3. DEDICATED MULTI-CAR CONVOY RACING (passing, "Cole Trickle!", "Rubbin is racing!", throwing $1/pens/pennies)
  p = await openPage('?pilot&player=jason&speed=1');
  await recordSegment(p, '03_convoy_racing_throws', async () => {
    await p.evaluate(() => {
      const L = window.__lf, M = L.mission(), sim = L.sim;
      for (let i = 0; i < Math.min(4, M.stops.length); i++) {
        const st = M.stops[i];
        if (!st.done) {
          st.done = true;
          const c = st.cars[0];
          c.x = sim.player.x - Math.cos(sim.player.h) * 58 * (i + 1);
          c.y = sim.player.y - Math.sin(sim.player.h) * 58 * (i + 1);
          c.h = sim.player.h; c.parked = false; c.follower = true;
          M.convoy.push({ car: c, person: st.people[0], joinedAt: M.time, ti: -1 });
        }
      }
    });
    await p.waitForTimeout(2000);
    await p.evaluate(() => {
      const L = window.__lf, M = L.mission(), sim = L.sim;
      if (M.convoy[0]) M.barks.say(M.convoy[0].car, 'COLE TRICKLE!', { urgent: true });
      if (M.convoy[1]) M.barks.say(M.convoy[1].car, "RUBBIN' IS RACING!", { urgent: true });
      for (let k = 0; k < 10; k++) {
        const from = M.convoy[k % M.convoy.length]?.car || sim.player;
        const kind = ['bill', 'pen', 'penny'][k % 3];
        if (M.barks.throwAt) M.barks.throwAt(kind, from, sim.player);
      }
    });
    await p.waitForTimeout(6000);
  });
  await p.close();

  // 4. FLOYDS' NIGHT PARTY INDOOR ROOM (t=0.88, packed lower-level party)
  p = await openPage('?player=clayton&nointro&t=0.88&party=floyds');
  await p.waitForFunction(() => window.__lf.inside(), null, { timeout: 20000 });
  await recordSegment(p, '04_floyds_party_indoor', async () => {
    await p.waitForTimeout(1200);
    const downX = await p.evaluate(() => window.__lf.inside().K.links.find(l => l.id === 'down' || l.to === 'lower')?.ax ?? null);
    if (downX !== null) {
      await walkInsideTo(p, downX);
      await p.keyboard.down('ArrowDown'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowDown');
      await p.waitForTimeout(3200);
    }
  });
  await p.close();

  // 5. ATHOLTON HS WALL CLIMB -> ROOF LOOKOUT OVER LAMAR'S BURNING MUSTANG
  p = await openPage('?player=jason&nointro');
  await p.waitForFunction(() => window.__lf.roof(), null, { timeout: 25000 });
  await recordSegment(p, '05_atholton_climb_and_mustang', async () => {
    await p.evaluate(() => {
      const L = window.__lf, RF = L.roof(), f = L.foot();
      const hold = RF.holds && RF.holds[0] ? RF.holds[0] : { x: RF.cx - 40, y: RF.cy };
      L.jumpTo({ pos: [hold.x, hold.y] });
      f.active = true; f.z = 0; f.x = hold.x; f.y = hold.y; f.px = f.x; f.py = f.y;
      L.cam.x = f.x; L.cam.y = f.y;
    });
    await p.waitForTimeout(1200);
    await p.keyboard.down('ArrowUp'); await p.waitForTimeout(2600); await p.keyboard.up('ArrowUp');
    await p.evaluate(() => {
      const L = window.__lf, RF = L.roof(), f = L.foot();
      f.z = RF.h; f.climb = null;
    });
    await p.waitForTimeout(3200);
  });
  await p.close();
} finally {
  await browser.close();
  srv.close();
}

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
console.log('MISSING SCENES VIDEO READY:', OUT_MP4);
