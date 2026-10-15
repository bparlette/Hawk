// node run_coop.js <port> <test: coop|edge|areas|perf> <w> <h> <outDir> <gameDir>: runs the game's own tests/coop/<test>.js (couch co-op split/merge etc.)
// with the playwright-core require pointed at this harness install; PASS = its *_ALL_PASS line (perf: no page errors).
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const [port, test, w, h, outDir = 'out', gameDir = '../../../game'] = process.argv.slice(2);
const name = `coop-${test}-${w}`, t0 = Date.now(); fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(__dirname, 'coop_tests'); fs.mkdirSync(tmp, { recursive: true });
for (const f of fs.readdirSync(path.join(gameDir, 'tests/coop'))) fs.writeFileSync(path.join(tmp, f), fs.readFileSync(path.join(gameDir, 'tests/coop', f), 'utf8').replace(/\/workspace\/work\/trailer_v2\/node_modules\/playwright-core/g, require.resolve('playwright-core')));
const r = spawnSync('node', [path.join(tmp, test + '.js'), port, w, h], { encoding: 'utf8', timeout: 25 * 60 * 1000, maxBuffer: 64 << 20 });
const out = (r.stdout || '') + (r.stderr || ''); process.stdout.write(out);
const fails = out.split('\n').filter((l) => /^FAIL |CRASH/.test(l)); const errLine = (out.match(/^ERRORS (\d+)/m) || [])[1];
const pass = test === 'perf' ? /"errs":\[\]/.test(out) : /_ALL_PASS/.test(out);
const res = { name, pass, reason: pass ? '' : (fails.slice(0, 3).join(' / ') || 'no ALL_PASS line').slice(0, 400), wall: Math.round((Date.now() - t0) / 1000), errors: errLine && +errLine ? [out.match(/^ERRORS .*/m)[0]] : [] };
fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(res, null, 2)); console.log('RESULT', JSON.stringify(res)); process.exit(pass ? 0 : 1);
