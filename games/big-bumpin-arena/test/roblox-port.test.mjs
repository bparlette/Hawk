// The Roblox port: the generated data module must match the JS source, and the Luau sim's own headless suite
// (bot matches on every arena, determinism, containment, rules) must pass. Needs `lune`; skipped if it is not installed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
test('roblox/BumpinData.luau is up to date with config.js and arenas.js', () => {
  const before = readFileSync(root + 'roblox/BumpinData.luau', 'utf8');
  execFileSync('node', [root + 'tools/export-roblox.mjs']);
  assert.equal(readFileSync(root + 'roblox/BumpinData.luau', 'utf8'), before, 'run tools/export-roblox.mjs and commit the result');
});
const hasLune = spawnSync('lune', ['--version']).status === 0;
test('Luau sim passes its headless suite under lune', { skip: !hasLune && 'lune is not installed' }, () => {
  const r = spawnSync('lune', ['run', 'tests/botmatch.luau'], { cwd: root + 'roblox', encoding: 'utf8' });
  if (r.status !== 0) console.log(r.stdout, r.stderr);
  assert.equal(r.status, 0); assert.match(r.stdout, /ALL PASS/);
});
