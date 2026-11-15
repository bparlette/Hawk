// Per-era audio pack (MOTH-BUILD.md build list item 2). Loads assets/<era>/audio/ via that
// era's manifest.json and plays it with WebAudio:
//   music + ambience loops, engine loop pitched by car speed, footsteps on the hero's
//   ground-covered phase wraps (surface from the sim: sand vs pavement), door on get in/out,
//   jingle when The Run finishes.
// Starts on first touch (unlock()); swaps with the era (setEra). An era with no asset pack
// (or a failed load) is simply silent — update() no-ops.
export function createEraAudio() {
  let ac = null, era = null, pack = null, nodes = null, prev = { mode: "foot", phase: 0, finished: false, steps: 0 };

  async function loadPack(id) {
    try {
      const base = `../assets/${id}/`;
      const M = await (await fetch(base + "manifest.json")).json();
      const files = { music: M.files["audio.music"], engine: M.files["audio.engine"], ambience: M.files["audio.ambience"],
                      door: M.files["audio.door"], stepA: M.files["audio.footstepA"], stepB: M.files["audio.footstepB"], jingle: M.files["audio.jingle"] };
      const bufs = {};
      for (const [k, f] of Object.entries(files)) {
        if (!f) continue;
        bufs[k] = await ac.decodeAudioData(await (await fetch(base + f)).arrayBuffer());
      }
      return bufs;
    } catch { return null; }
  }
  function startLoops() {
    if (!ac || !pack) return;
    stopLoops();
    const mk = (buf, gain) => {
      if (!buf) return null;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = gain;
      src.connect(g).connect(ac.destination); src.start();
      return { src, g };
    };
    nodes = { music: mk(pack.music, 0.4), ambience: mk(pack.ambience, 0.28), engine: mk(pack.engine, 0) };
  }
  function stopLoops() {
    if (!nodes) return;
    for (const n of Object.values(nodes)) if (n) { try { n.src.stop(); } catch {} n.src.disconnect(); }
    nodes = null;
  }
  function oneShot(buf, gain = 0.5) {
    if (!ac || !buf) return;
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(g).connect(ac.destination); src.start();
  }

  return {
    async unlock() {
      if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); pack = await loadPack(era || "e1"); startLoops(); }
      if (ac.state === "suspended") ac.resume();
    },
    async setEra(id) {
      era = id;
      if (!ac) return;
      stopLoops(); pack = await loadPack(id); startLoops();
    },
    update(sim) {
      if (!ac || !pack || !nodes) return;
      const t = ac.currentTime;
      if (nodes.engine) {
        const driving = sim.mode === "drive";
        const target = driving ? 0.2 : 0.0;
        nodes.engine.g.gain.setTargetAtTime(target, t, 0.1);
        nodes.engine.src.playbackRate.setTargetAtTime(0.75 + Math.min(1, Math.abs(sim.car.v) / 15) * 0.9, t, 0.1);
      }
      if (sim.mode !== prev.mode) oneShot(pack.door, 0.5);
      if (sim.mode === "foot" && sim.hero.speed > 0.1) {
        if (sim.hero.phase < prev.phase || (prev.phase < 0.5 && sim.hero.phase >= 0.5)) {
          prev.steps++;
          oneShot(sim.groundAt(sim.hero.x, sim.hero.y) === "b" ? pack.stepB : pack.stepA, 0.35);
        }
      }
      if (sim.finished && !prev.finished) oneShot(pack.jingle, 0.6);
      prev = { mode: sim.mode, phase: sim.hero.phase, finished: sim.finished, steps: prev.steps };
    },
    dispose() { stopLoops(); if (ac) ac.close(); ac = null; },
  };
}
