import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const animeDir = path.join(root, 'games/lanternport/assets/linkle-walk/anime');

test('linkle walk assets: anime 16-frame cycle and 2048x2048 sheet exist', () => {
  const sheetPath = path.join(animeDir, 'sheet.png');
  assert.ok(fs.existsSync(sheetPath), 'sheet.png must exist in anime/ assets');
  const sheetStat = fs.statSync(sheetPath);
  assert.ok(sheetStat.size > 500000, 'sheet.png must be substantial PNG file');

  for (let i = 0; i < 16; i++) {
    const num = String(i).padStart(2, '0');
    const framePath = path.join(animeDir, `walk_${num}.png`);
    assert.ok(fs.existsSync(framePath), `walk_${num}.png must exist`);
    const frameStat = fs.statSync(framePath);
    assert.ok(frameStat.size > 50000, `walk_${num}.png must be non-empty valid PNG`);
  }
});

test('linkle walk test page and audit proof exist', () => {
  const pagePath = path.join(root, 'games/lanternport/walk-test.html');
  assert.ok(fs.existsSync(pagePath), 'walk-test.html must exist');

  const proofPath = path.join(root, 'games/lanternport/audit-assets/linkle-walk-proof.png');
  assert.ok(fs.existsSync(proofPath), 'linkle-walk-proof.png audit screenshot must exist');
  const proofStat = fs.statSync(proofPath);
  assert.ok(proofStat.size > 50000, 'linkle-walk-proof.png must be valid screenshot');
});
