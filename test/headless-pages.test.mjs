import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const urls = [
  'http://localhost:8765/games/lanternport/index.html?scene=cucco-swarm&loop=1',
  'http://localhost:8765/games/lanternport/index.html?scene=pot-rampage&loop=1',
  'http://localhost:8765/games/lanternport/index.html?scene=chest-fanfare&loop=1',
  'http://localhost:8765/games/lanternport/index.html?scene=dock-fishing&loop=1',
  'http://localhost:8765/games/lanternport/index.html?scene=fairy-orbit&loop=1',
];

for (const u of urls) {
  test(`headless page loads clean: ${u.split('?')[1]}`, () => {
    const out = execSync(`"${CHROME}" --headless --user-data-dir=/tmp/gate-p --window-size=390,844 --dump-dom "${u}"`, { timeout: 15000, encoding: 'utf8' });
    assert.ok(out.includes('<canvas'), 'canvas present');
  });
}
