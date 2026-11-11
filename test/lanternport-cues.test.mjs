// Sound-cue coverage check: assert every film scene's event beats have a matching sound cue
// in that scene's definition, or an explicit silent: true note on the beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES } from '../games/lanternport/scenes.js';

test('every film scene event beat has a matching sound cue or silent: true', () => {
  const filmScenes = SCENES.filter((s) => Array.isArray(s.events) && Array.isArray(s.sound));
  assert.ok(filmScenes.length >= 2, `expected at least 2 film scenes, found ${filmScenes.length}`);

  const missing = [];
  for (const s of filmScenes) {
    const cues = s.sound || [];
    for (const b of (s.events || [])) {
      if (b.silent) continue;
      // An event beat has a matching cue if a sound cue fires within +/- 2 ticks of beat.at
      const match = cues.some((c) => Math.abs(c.at - b.at) <= 2);
      if (!match) {
        missing.push({ scene: s.id, beat: b.name, at: b.at });
      }
    }
  }

  assert.deepEqual(missing, [], `beats missing sound cue or silent: true: ${JSON.stringify(missing, null, 2)}`);
});
