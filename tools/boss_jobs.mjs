// tools/boss_jobs.mjs — writes the preview job list for one boss: node tools/boss_jobs.mjs <id> > jobs.json; then
// node tools/shoot.mjs --batch jobs.json (REPORT=tools/shots_<id>.json keeps every job's console errors and report).
import fs from 'node:fs';
const id = process.argv[2], P = process.env.PAGE || (fs.existsSync('viewer_bosses.html') ? 'viewer_bosses.html' : 'viewer.html'), o = (n) => `previews/${id}_${n}.png`;
const J = [
  [o('day'), 'cam=three&t=1.1', 1280, 720], [o('night'), 'cam=three&t=1.1&night=1', 1280, 720],
  [o('phone_390x844'), 'cam=phone&t=1.1', 390, 844], [o('phone_390x844_night'), 'cam=phone&t=1.1&night=1', 390, 844],
  [o('phone_390x844_merged'), 'cam=phone&t=1.1&merge=1', 390, 844], [o('phone_390x844_night_merged'), 'cam=phone&t=1.1&night=1&merge=1', 390, 844],
  [o('merged_day'), 'cam=three&t=1.1&merge=1', 1280, 720], [o('merged_night'), 'cam=three&t=1.1&night=1&merge=1', 1280, 720],
  [o('merged_flash'), 'cam=three&t=1.1&merge=1&flash=0.85', 1280, 720], [o('flash_unmerged'), 'cam=three&t=1.1&flash=0.85', 1280, 720],
  [o('turn'), 'turn=1&t=1.1', 1600, 640], [o('poses'), 'pose=all&t=1.1', 1800, 600], [o('poses_night_merged'), 'pose=all&t=1.1&night=1&merge=1', 1800, 600],
  [o('angry'), 'pose=all&t=1.1&angry=1', 1800, 600],
  [o('atk1_strip'), 'strip=atk1&n=8', 1800, 520], [o('atk2_strip'), 'strip=atk2&n=8', 1800, 520], [o('atk3_strip'), 'strip=atk3&n=8', 1800, 520],
  [o('knockdown_strip'), 'strip=knockdown&n=9', 1800, 520], [o('knockdown_strip_merged'), 'strip=knockdown&n=9&merge=1', 1800, 520],
  [o('sheet'), 'sheet=1&t=1.1', 2048, 1024],
];
console.log(JSON.stringify(J.map(([out, q, w, h]) => ({ out, page: P, q: 'show=' + id + '&' + q + (q.includes('sheet') ? '' : '&ui=0'), w, h }))));
