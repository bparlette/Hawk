// _canary: tcr2-h2-lint-oyster
// tc_lint.mjs <folder> : lint a Toad City delivery folder (read-only, no network, no deps).
// Node 18+ ES module. Usage: node tc_lint.mjs <folder>
// Scans <folder>/src/*.js and <folder>/README*.md. Prints a markdown table.
// Exit 1 if any ERROR finding; WARN findings never change the exit code; else exit 0.
//
// The 11 patterns from the H2 prompt §3, mapped to 11 numbered checks:
//  C1  any `import` statement                                   ERROR
//  C2  `Math.random(`                                           ERROR
//  C3  `new THREE.Mesh*Material` / MeshStandard / MeshPhysical  ERROR
//  C4  PointLight / SpotLight / DirectionalLight                ERROR
//  C5  TextureLoader / GLTFLoader (asset loaders)               ERROR
//  C6  `fetch(` / `http` (network access)                       ERROR
//  C7  `frustumCulled = false`                                  ERROR
//  C8  `{ ... outline: false ... }` on a line w/o `shadow: false` ERROR
//  C9  bare `export const META ` (want META_<NAME>)             WARN only
//  C10 module-level WeakMap/Map cache .get(K)/.has(K)           ERROR
//  C11 README line with about/approx/~ next to a number         ERROR
// Round-1 lessons live in reference/lint_targets/LESSONS.md (the only lint_targets file).
// Checks not listed there come from the H2 prompt §3 house rules (prompts/H2_lint-scripts.md).
// No regex lookbehind is used anywhere (Safari-safe habit).

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const folder = process.argv[2];
if (!folder || !existsSync(folder) || !statSync(folder).isDirectory()) {
  console.error('usage: node tc_lint.mjs <folder>');
  process.exit(2);
}

const findings = [];
const add = (level, file, line, check, text) =>
  findings.push({ level, file, line, check, snip: text.trim().slice(0, 70) });

// Per-line JS checks. Each: [id, level, test(line) -> bool]
const LINE_CHECKS = [
  // catches: kit modules must be self-contained; imports break concatenation (prompts/H2_lint-scripts.md §3)
  ['C1 import', 'ERROR', (l) => /^\s*import[\s{*'"]/.test(l) || /\bimport\s*\(/.test(l)],
  // catches: non-deterministic blocks; variation must come from the seeded RNG (prompts/H2_lint-scripts.md §3)
  ['C2 Math.random', 'ERROR', (l) => l.includes('Math.random(')],
  // catches: lit PBR materials break the cel-shaded look (prompts/H2_lint-scripts.md §3)
  ['C3 Mesh*Material', 'ERROR', (l) => /new\s+THREE\.Mesh\w*Material/.test(l) || /Mesh(Standard|Physical)Material/.test(l)],
  // catches: extra scene lights in modules; the game owns lighting (prompts/H2_lint-scripts.md §3)
  ['C4 light', 'ERROR', (l) => /\b(PointLight|SpotLight|DirectionalLight)\b/.test(l)],
  // catches: external asset loading; everything is procedural (prompts/H2_lint-scripts.md §3)
  ['C5 loader', 'ERROR', (l) => /\b(TextureLoader|GLTFLoader)\b/.test(l)],
  // catches: network access from a module (prompts/H2_lint-scripts.md §3)
  ['C6 network', 'ERROR', (l) => l.includes('fetch(') || l.includes('http')],
  // catches: frustumCulled = false on the dragon-boat paddles, Task B m8 (reference/lint_targets/LESSONS.md)
  ['C7 frustumCulled', 'ERROR', (l) => /frustumCulled\s*=\s*false/.test(l)],
  // catches: outline:false parts without shadow:false, Harbor Rats whiskers cast shadows (reference/lint_targets/LESSONS.md)
  ['C8 outline w/o shadow', 'ERROR', (l) => /\{[^}]*outline\s*:\s*false/.test(l) && !/shadow\s*:\s*false/.test(l)],
  // catches: export const META in every file collided on concatenation, Task A/B m13 (reference/lint_targets/LESSONS.md)
  ['C9 bare META', 'WARN', (l) => /^\s*export\s+const\s+META\s/.test(l) || /^\s*export\s+const\s+META=/.test(l)],
];

// C10 helper: names of module-level (unindented) Map/WeakMap caches in a file.
function topLevelCaches(lines) {
  const names = new Set();
  for (const l of lines) {
    const m = /^(?:const|let|var)\s+(\w+)\s*=\s*new\s+(?:Weak)?Map\s*\(/.exec(l);
    if (m) names.add(m[1]);
  }
  return names;
}

// Scan src/*.js
const srcDir = join(folder, 'src');
const jsFiles = existsSync(srcDir) ? readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort() : [];
for (const f of jsFiles) {
  const rel = 'src/' + f;
  const lines = readFileSync(join(srcDir, f), 'utf8').split(/\r?\n/);
  const caches = topLevelCaches(lines);
  lines.forEach((l, i) => {
    for (const [id, level, test] of LINE_CHECKS) if (test(l)) add(level, rel, i + 1, id, l);
    // catches: texture cache keyed on K, Harbor Rats fur cache; key must be K.QUAL || K.THREE || K (reference/lint_targets/LESSONS.md)
    for (const name of caches) {
      const re = new RegExp('\\b' + name + '\\.(get|has)\\(\\s*K\\s*[,)]');
      if (re.test(l)) add('ERROR', rel, i + 1, 'C10 cache key K', l);
    }
  });
}

// Scan README*.md in the folder root
// catches: README "about 34 hulls" (measured 28-29), unmeasured numbers (reference/lint_targets/LESSONS.md)
const NUM_HEDGE = [
  /\b(about|approx\.?|approximately)\s*\d/i, // about 34, approx 12
  /\d[\w.]*\s*(about|approx)\b/i,            // 34 approx
  /~\s*\d/,                                  // ~12
  /\d\s*~/,                                  // 12~
];
const readmes = readdirSync(folder).filter((f) => /^README.*\.md$/i.test(f)).sort();
for (const f of readmes) {
  readFileSync(join(folder, f), 'utf8').split(/\r?\n/).forEach((l, i) => {
    if (NUM_HEDGE.some((re) => re.test(l))) add('ERROR', f, i + 1, 'C11 README estimate', l);
  });
}

// Output markdown table
const esc = (s) => String(s).replace(/\|/g, '\\|');
console.log(`# tc_lint: ${basename(folder)} (${jsFiles.length} js, ${readmes.length} README)\n`);
console.log('| Level | File | Line | Check | Snippet |');
console.log('|---|---|---|---|---|');
for (const x of findings) console.log(`| ${x.level} | ${esc(x.file)} | ${x.line} | ${x.check} | \`${esc(x.snip)}\` |`);
const errs = findings.filter((x) => x.level === 'ERROR').length;
const warns = findings.length - errs;
console.log(`\n${errs} error(s), ${warns} warning(s).`);
// Exit 1 on any ERROR; warnings alone exit 0.
process.exit(errs > 0 ? 1 : 0);
