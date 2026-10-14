// node tools/batch.mjs jobs.json  — jobs: [{ q: "show=...&night=1", out: "previews/x.png", w, h, dpr }]  (one browser, many shots)
import { open, load, root } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let cur = null, b = null, page = null; let bad = 0;
for (const j of jobs) {
  const key = `${j.w || 1280}x${j.h || 720}@${j.dpr || 1}`;
  if (key !== cur) { if (b) await b.close(); cur = key; b = await open({ w: j.w || 1280, h: j.h || 720, dpr: j.dpr || 1 }); page = await b.newPage(); }
  b.errors.length = 0;
  await load(page, b.port, j.q + '&hud=' + (j.hud ? 1 : 0));
  if (j.steps) await page.evaluate((n) => window.__api.step(n), j.steps);
  fs.mkdirSync(path.dirname(path.resolve(root, j.out)), { recursive: true });
  await page.screenshot({ path: path.resolve(root, j.out) });
  const errs = (await page.evaluate(() => window.__errors)).concat(b.errors.filter((e) => !/404/.test(e)));
  if (errs.length) { bad++; console.log('ERR in', j.out, errs.slice(0, 3)); }
}
if (b) await b.close(); console.log('done', jobs.length, 'shots, with errors:', bad);
