// Era 4 — GTA: Vice City (2002) × The Wind Waker Toon Link. A thin era module over the shared 3D engine
// (play/engine/world3d.js), per engine/README-ERA-CONTRACT.md — a CONFIG + a
// HUD skin, never a new engine. Shape copied from eras/e3.js (Lane B).
//
// Look (assets/e4/LOOK.md): sunset pastel Miami: art-deco flamingo pink / seafoam / peach / ocean cyan (pack tiles.artDecoWallPalette), neon script grade from the sunset wash
// Camera/fog/wash/lampGlow numbers are the pack's own manifest values
// (cameraHint / fogHint / lighting) — the cameraHint frames exactly the locked
// 33.6 m across at the player's ground point; fog is measured from the
// player's ground point, never the camera (the Opus rule).
// Movement: Vice City entry split (research/e4-movement): Faggio leg-over ~0.8-1.0 s, Cheetah driver-yank ~1.6-1.8 s. The engine's sequencer is one run-around path, so doorSec splits the difference toward the yank; Toon Link's dive-roll (0.55-0.65 s) is hero flavour in the shared model.
import { createWorld3D } from "../engine/world3d.js?v=2026-11-16-1";

const ASSET_BASE = new URL("../../assets/e4/", import.meta.url).href;   // from THIS module's URL, never the document's (e1 saga)
const BUILD = "2026-11-16-1";
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});

export function create(canvas, level) {
  canvas.dataset.e4build = BUILD;
  const engine = createWorld3D(canvas, level, {
    era: "e4", name: "GTA: Vice City (2002)", assetBase: ASSET_BASE, build: BUILD,
    camera: { pitchDeg: 48, fovDeg: 55, distanceM: 66.1, pullBack: 0.12 },
    fog: { color: "#df9bb0", nearFromPlayerM: 39, farFromPlayerM: 135 },
    sky: "#28a4dc",
    renderScale: 240 / 420,
    palette: {
      facade: ["#f37eb8", "#7fd8b0", "#f4b87c", "#28a4dc", "#eef4f4", "#f0cc3a"],
      trunk: "#5a4632", bench: "#7a6a58", pole: "#3c4148",
      bush: ["#2f7a3c", "#3f8a46", "#f37eb8", "#7fd8b0"],
    },
    heroCarStrip: "convertible_blue",
    entry: { style: "runaround", doorSec: 0.4 },
    lighting: { hemiSky: "#ffd8e8", hemiGround: "#4a4038", hemiIntensity: 1.05, sunColor: "#ffe0b8", sunIntensity: 0.55 },
    wash: { file: "lighting/sunset-wash.png", strength: 0.45 },
    lampGlow: 0.68,
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
    const lines = [`e4 build ${BUILD} — ${err ? "FALLBACK" : "loading " + stage}`];
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
    name: "GTA: Vice City (2002)",
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
  if (typeof window !== "undefined") window.__e4 = view;   // tools/evidence handle
  return view;
}
