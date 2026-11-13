// Rigged walker everywhere (Cherie, Nov 13: "The whole game of Lanternport
// should be the rigged walker — the old character should not exist or should
// be moved to a background character").
// - pickPlayerClip gains a seated branch (vehicle rides stay rigged, on the
//   sit-rim clip) without changing any existing clip decision;
// - index.html must wire the player rig into the whole game: loaded at
//   restart (free roam from spawn), following heroes[0] (Juniper) whenever no
//   staged performance owns the screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickPlayerClip, VEHICLE_SEAT_Y_OFFSET } from '../games/lanternport/playerrig.js';
import { STANDING_Y_OFFSET } from '../games/lanternport/heroglb.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('pickPlayerClip: seated in a vehicle she sits on the sit-rim clip', () => {
  const seat = pickPlayerClip({ action: 'idle', speed: 0, swimming: false, danceClip: null, seated: true });
  assert.deepEqual(seat, { clip: 'sit-rim', loop: true, rate: 1, yOffset: VEHICLE_SEAT_Y_OFFSET });
  // Seated wins over swimming/dance, exactly like a driver who never leaves the seat.
  assert.equal(pickPlayerClip({ action: 'walk', speed: 9, swimming: true, danceClip: 'dance-cartop', seated: true }).clip, 'sit-rim');
  // Existing decisions are untouched when she is on foot.
  assert.deepEqual(pickPlayerClip({ action: 'idle', speed: 0, swimming: false, danceClip: null }),
    { clip: 'idle-stand', loop: true, rate: 1, yOffset: STANDING_Y_OFFSET });
  assert.equal(pickPlayerClip({ action: 'walk', speed: 11, swimming: false, danceClip: null }).clip, '07_01');
});

test('index.html: the rigged walker is the hero of the whole game, not only of scenes', async () => {
  const html = await readFile(path.join(ROOT, 'games/lanternport/index.html'), 'utf8');
  // Loaded from spawn: restart() builds the player rig (free roam included).
  assert.match(html, /heroViews = LOOKS\.map[\s\S]{0,400}ensurePlayerRig\(\); \/\/ the rigged walker is the hero from spawn/);
  // The frame loop follows heroes[0] and only stands down while a staged
  // performance owns the screen (hideFreeHero).
  assert.match(html, /const h0 = g\.heroes\[0\], hv0 = heroViews\[0\];/);
  assert.match(html, /const rigOn = Boolean\(playerRig\.ready && hv0 && !hideFreeHero\);/);
  // Her procedural HeroView is hidden whenever the rig is on.
  assert.match(html, /hv0\.group\.visible = false; hv0\.shadow\.visible = false; hv0\.ring\.visible = false;/);
});
