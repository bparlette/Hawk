// proof shots of the generated showcase pages at phone size:  NODE_PATH=$(npm root -g) node tools/factory/showcase_shots.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright-core'); import path from 'path'; import { fileURLToPath } from 'url';
const lf = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const b = await chromium.launch(); 
for (const [tag, dir] of [['laurel', lf], ['savage', path.join(lf, '../savage')]]) {
  const p = await b.newPage({ viewport: { width: 420, height: 860 } });
  await p.goto('file://' + path.join(dir, 'showcase.generated.html')); await p.waitForTimeout(800);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(tag, 'horizontal overflow px:', over);
  await p.screenshot({ path: path.join(lf, `shots/l9-${tag}-top.png`) });
  for (const id of ['map', 'crew', 'cars', 'heroes', 'fleet', 'ledger']) {
    await p.evaluate(i => document.getElementById(i)?.scrollIntoView(), id); await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(lf, `shots/l9-${tag}-${id}.png`) });
  }
  await p.screenshot({ path: path.join(lf, `shots/l9-${tag}-full.png`), fullPage: true });
}
await b.close();
