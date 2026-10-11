// node tools/shoot.mjs "show=block&night=1" out.png [w] [h] [dpr]
import { open, load, root } from './lib.mjs';
import path from 'node:path';
const [query, out, w = 1280, h = 720, dpr = 1] = process.argv.slice(2);
const b = await open({ w: +w, h: +h, dpr: +dpr }); const page = await b.newPage();
await load(page, b.port, query + '&hud=' + (process.env.HUD ? 1 : 0));
await page.screenshot({ path: path.resolve(root, out) });
const errs = await page.evaluate(() => window.__errors);
console.log('saved', out, 'viewer errors:', errs.length, 'console:', b.errors.length); errs.forEach((e) => console.log('  ERR', e)); b.errors.forEach((e) => console.log('  CON', e));
await b.close();
