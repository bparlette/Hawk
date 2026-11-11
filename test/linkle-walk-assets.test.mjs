import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const animeDir = path.join(root, 'games/lanternport/assets/linkle-walk/anime');

function readPngDimensions(buffer) {
  // PNG IHDR chunk starts at byte 12, width at byte 16, height at byte 20
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25); // 6 = RGBA
  return { width, height, bitDepth, colorType };
}

test('linkle walk assets: anime 8-frame phase cycle and 2048x1024 sheet exist and have valid format', () => {
  const sheetPath = path.join(animeDir, 'sheet.png');
  assert.ok(fs.existsSync(sheetPath), 'sheet.png must exist');
  const sheetBuf = fs.readFileSync(sheetPath);
  const sheetMeta = readPngDimensions(sheetBuf);
  assert.strictEqual(sheetMeta.width, 2048, 'sheet width must be 2048');
  assert.strictEqual(sheetMeta.height, 1024, 'sheet height must be 1024');
  assert.strictEqual(sheetMeta.colorType, 6, 'sheet must be RGBA (colorType 6)');

  const hashes = new Set();
  const frameHashes = [];

  for (let i = 0; i < 8; i++) {
    const num = String(i).padStart(2, '0');
    const framePath = path.join(animeDir, `walk_${num}.png`);
    assert.ok(fs.existsSync(framePath), `walk_${num}.png must exist`);
    const frameBuf = fs.readFileSync(framePath);
    const meta = readPngDimensions(frameBuf);
    assert.strictEqual(meta.width, 512, `walk_${num}.png width must be 512`);
    assert.strictEqual(meta.height, 512, `walk_${num}.png height must be 512`);
    assert.strictEqual(meta.colorType, 6, `walk_${num}.png must be RGBA (colorType 6)`);

    const hash = crypto.createHash('md5').update(frameBuf).digest('hex');
    hashes.add(hash);
    frameHashes.push(hash);
  }

  // Verify uniqueness: all 16 frames must have distinct checksums
  assert.strictEqual(hashes.size, 8, 'All 8 frames must have unique checksums (no duplicate frames)');
  // Specifically verify walk_00 != walk_04 (contact left vs contact right)
  assert.notStrictEqual(frameHashes[0], frameHashes[4], 'walk_00 and walk_04 must not be identical');
});

test('linkle walk test page, contact sheet preview, and audit proof exist', () => {
  const pagePath = path.join(root, 'games/lanternport/walk-test.html');
  assert.ok(fs.existsSync(pagePath), 'walk-test.html must exist');

  const contactPath = path.join(root, 'games/lanternport/audit-assets/anime_contact_sheet_preview.png');
  assert.ok(fs.existsSync(contactPath), 'anime_contact_sheet_preview.png must exist');

  const proofPath = path.join(root, 'games/lanternport/audit-assets/linkle-walk-proof.png');
  assert.ok(fs.existsSync(proofPath), 'linkle-walk-proof.png audit screenshot must exist');
  const proofStat = fs.statSync(proofPath);
  assert.ok(proofStat.size > 50000, 'linkle-walk-proof.png must be valid screenshot');
});
