// node qa/sim.js <eventIdx> <seconds> [runs] : headless logic-only run of an event with the bot as the human (no browser, no render)
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../build/index.html', 'utf8');
let code = html.split('<script type="module">')[1].split('</script>')[0].replace(/^import .*$/m, '');
const mk = () => { const f = function () {}; return new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : k === Symbol.iterator ? function* () {} : k === 'then' ? undefined : mk(), apply: () => mk(), construct: () => mk(), set: () => true }); };
const S = mk();
const fakeEl = () => ({ addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, setPointerCapture() {}, getContext: () => S, textContent: '', innerHTML: '', appendChild() {}, querySelectorAll: () => [], focus() {}, blur() {}, width: 0, height: 0 });
const document = { getElementById: fakeEl, createElement: fakeEl, addEventListener() {}, querySelector: () => null, hidden: false };
const window = { addEventListener() {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 };
const navigator = { maxTouchPoints: 0, getGamepads: () => [] };
const localStorage = { getItem: () => null, setItem() {} };
const matchMedia = () => ({ matches: false });
const requestAnimationFrame = () => 0;
const f = new Function('THREE', 'document', 'window', 'navigator', 'localStorage', 'matchMedia', 'requestAnimationFrame', 'performance', code + '\n;return window.__cg;');
const cg = f(S, document, window, navigator, localStorage, matchMedia, requestAnimationFrame, { now: () => 0 });
module.exports = cg;
if (require.main === module) {
const ev = +process.argv[2], secs = +(process.argv[3] || 80), runs = +(process.argv[4] || 1);
const out = [];
for (let r = 0; r < runs; r++) {
  cg.QA.bot = true; cg.Game.handOver(); cg.startComp('practice', [ev]);
  let n = 0; while (n < secs * 60) { cg.Game.step(1 / 60); n++; if (cg.R.ended) break; }
  out.push({ score: cg.R.score, falls: cg.R.falls, timeLeft: Math.round(cg.R.time), best: cg.R.best, end: cg.R.endReason, t: (n / 60).toFixed(1), log: cg.QLOG.splice(0).slice(0, 8) });
}
console.log(JSON.stringify(out));
}
