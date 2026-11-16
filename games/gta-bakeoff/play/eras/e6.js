// Era 6 — GTA IV (2008) × Twilight Princess (2006) Link. A thin era module over the shared 3D engine
// (play/engine/world3d.js), per engine/README-ERA-CONTRACT.md — a CONFIG + a
// HUD skin, never a new engine. Shape copied from eras/e3.js (Lane B).
//
// Look (assets/e6/LOOK.md): desaturated Liberty City overcast: grey-green haze, damp asphalt, worn brick and concrete, the pack's overcast wash at 0.58 — the heaviest grade of any era
// Camera/fog/wash/lampGlow numbers are the pack's own manifest values
// (cameraHint / fogHint / lighting) — the cameraHint frames exactly the locked
// 33.6 m across at the player's ground point; fog is measured from the
// player's ground point, never the camera (the Opus rule).
// Movement: GTA IV entry (research/e6-movement): two-handed door latch, wide steel-door swing, Euphoria push-pull if contested — the slowest, weightiest entry of the set, so the largest doorSec. The study gives no fixed duration (flagged gap); TP'06 Link gets turn-lean + heavy boot plants in the shared model.
import { createWorld3D } from "../engine/world3d.js?v=2026-11-16-1";

const ASSET_BASE = new URL("../../assets/e6/", import.meta.url).href;   // from THIS module's URL, never the document's (e1 saga)
const BUILD = "2026-11-16-1";
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});

export function create(canvas, level) {
  canvas.dataset.e6build = BUILD;
  const engine = createWorld3D(canvas, level, {
    era: "e6", name: "GTA IV (2008)", assetBase: ASSET_BASE, build: BUILD,
    camera: { pitchDeg: 36, fovDeg: 50, distanceM: 73.9, pullBack: 0.08 },
    fog: { color: "#686e66", nearFromPlayerM: 44, farFromPlayerM: 150 },
    sky: "#b2b6ba",
    renderScale: 240 / 420,
    palette: {
      facade: ["#6e7276", "#7a7e82", "#5d646d", "#88867a", "#4c525a", "#8a4a3a"],
      trunk: "#4a3a2c", bench: "#5a4c3e", pole: "#33373d",
      bush: ["#3a5230", "#44582f", "#5d646d", "#6a7076"],
    },
    heroCarStrip: "sedan_gold",
    entry: { style: "runaround", doorSec: 1.6 },
    lighting: { hemiSky: "#c8ced2", hemiGround: "#44443f", hemiIntensity: 1.0, sunColor: "#d8dde2", sunIntensity: 0.4 },
    wash: { file: "lighting/overcast-iv.png", strength: 0.58 },
    lampGlow: 0.62,
  });

  // ---- HUD skin (same shape as eras/e3.js): 2D overlay canvas above the game
  // canvas, pack glyph font, district bar + VICE BEACH + timer + finish banner,
  // diagnostics box while loading / on fallback.
  const hud = document.createElement("canvas");
  hud.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  canvas.parentElement.insertBefore(hud, canvas.nextSibling);
  const hx = hud.getContext("2d");
  let M = null, hudImg = null;
  (async () => {
    try {
      const resp = await fetch(ASSET_BASE + "manifest.json?v=" + BUILD);
      if (!resp.ok) throw new Error("manifest HTTP " + resp.status);
      M = await resp.json();
      hudImg = await loadImg(ASSET_BASE + M.files.hudFont + "?v=" + BUILD);
    } catch { /* HUD silently absent; the engine's own diagnostics still report */ }
  })();
  function drawText(text, x, y, scale, align = "left") {
    const gw = M.hudFont.cellW * scale, gh = M.hudFont.cellH * scale;
    let dx = align === "center" ? x - text.length * gw / 2 : align === "right" ? x - text.length * gw : x;
    for (const ch of text) {
      const g = M.hudFont.glyphs[ch];
      if (g) hx.drawImage(hudImg, g.x, g.y, g.w, g.h, Math.round(dx), Math.round(y), gw, gh);
      dx += gw;
    }
  }
  function drawDiag(W, H) {
    const err = canvas.dataset.w3derr || "", stage = canvas.dataset.w3dstage || "";
    const lines = [`e6 build ${BUILD} — ${err ? "FALLBACK" : "loading " + stage}`];
    if (err) for (let i = 0; i < err.length && lines.length < 5; i += 44) lines.push(err.slice(i, i + 44));
    hx.font = "11px ui-monospace,Menlo,monospace"; hx.textBaseline = "top";
    const lw = Math.min(W - 16, 10 + Math.max(...lines.map(s => hx.measureText(s).width)));
    const lh = lines.length * 14 + 8, ly = H - lh - 10;
    hx.fillStyle = "rgba(0,0,0,.8)"; hx.fillRect(8, ly, lw, lh);
    hx.fillStyle = "#ffd75e";
    lines.forEach((s, i) => hx.fillText(s, 13, ly + 4 + i * 14));
  }
  function drawHUD(sim, W, H) {
    if (M && hudImg) {
      const bar = M.hudFont.hudSprites.districtBar;
      hx.drawImage(hudImg, bar.x, bar.y, bar.w, bar.h, Math.round((W - bar.w) / 2), 6, bar.w, bar.h);
      drawText("VICE BEACH", W / 2, 9, 1, "center");
      const t = sim.t, ts = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}.${Math.floor(t * 10 % 10)}`;
      drawText(ts, W - 8, 44, 0.75, "right");
      if (sim.finished) drawText(`THE RUN ${t.toFixed(1)}S`, W / 2, Math.round(H * 0.42), 1.5, "center");
    }
    if (canvas.dataset.state !== "ready") drawDiag(W, H);
  }

  const view = {
    name: "GTA IV (2008)",
    draw(sim) {
      engine.draw(sim);
      const cw = hud.clientWidth || 420, ch = hud.clientHeight || 860;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
      if (hud.width !== bw || hud.height !== bh) { hud.width = bw; hud.height = bh; }
      hx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hx.clearRect(0, 0, cw, ch);
      drawHUD(sim, cw, ch);
    },
    wrapInput: (inp, sim) => engine.wrapInput(inp, sim),
    debug: engine.debug,
    get entryState() { return engine.entryState; },
    dispose() { hud.remove(); engine.dispose(); },
  };
  if (typeof window !== "undefined") window.__e6 = view;   // tools/evidence handle
  return view;
}
