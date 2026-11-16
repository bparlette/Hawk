// Era 3 — GTA III (2001) × Majora's Mask Young Link. The first 3D era: a thin
// era module over the shared 3D engine (play/engine/world3d.js). Everything
// era-specific lives in the CONFIG below + the HUD skin on the overlay canvas;
// the world, movement, entry sequencer and camera are the engine's, shared
// with e4–e8.
//
// Look (assets/e3/LOOK.md, from research/gta3/): muted grey-blue overcast,
// short ~90 m fog, flat-shaded early-RenderWare geometry, blob shadows, the
// pack's own tiles/sprites re-skinning the real GTA 1 layout. Camera: pitch
// 55° per ERAS.md, distance/FOV from the pack's cameraHint — 59.6 m at FOV 60
// frames exactly the locked 33.6 m across at the player's ground point.
// Movement (research/e3-movement/MOVEMENT.md): NO hood slide — the engine's
// run-around entry walks Link around the front bumper to the driver door
// (~2.5 s from the passenger side), door swings + duck beat (doorSec), brake
// lights flare on ignition. Young Link leans into a run; upright at idle.
import { createWorld3D } from "../engine/world3d.js?v=2026-11-16-1";

const ASSET_BASE = new URL("../../assets/e3/", import.meta.url).href;   // from THIS module's URL, never the document's (e1 saga)
const BUILD = "2026-11-16-1";
const loadImg = (src, ms = 25000) => new Promise((res, rej) => {
  const i = new Image(), t = setTimeout(() => rej(new Error("timeout loading " + src)), ms);
  i.onload = () => { clearTimeout(t); res(i); };
  i.onerror = () => { clearTimeout(t); rej(new Error("load error " + src)); };
  i.src = src;
});

export function create(canvas, level) {
  canvas.dataset.e3build = BUILD;
  const engine = createWorld3D(canvas, level, {
    era: "e3", name: "GTA III (2001)", assetBase: ASSET_BASE, build: BUILD,
    camera: { pitchDeg: 55, fovDeg: 60, distanceM: 59.6, pullBack: 0.12 },
    fog: { color: "#7d8e98", nearFromPlayerM: 26, farFromPlayerM: 90 },
    sky: "#8ca2ab",
    renderScale: 240 / 420,
    palette: {
      facade: ["#6a7076", "#7a6a5e", "#5d646d", "#71685f", "#4c525a", "#83776a"],
      trunk: "#5a4632", bench: "#6b5a49", pole: "#3c4148",
      bush: ["#3f6126", "#4a5d23", "#5d646d", "#6a7076"],
    },
    heroCarStrip: "sedan_gold",
    entry: { style: "runaround", doorSec: 1.15 },
    lighting: { hemiSky: "#b8c4cc", hemiGround: "#4a4a48", hemiIntensity: 1.05, sunColor: "#d8dde2", sunIntensity: 0.5 },
    wash: { file: "lighting/overcast-wash.png", strength: 0.55 },
    lampGlow: 0.5,
  });

  // ---- HUD skin: a 2D overlay canvas slotted directly above the game canvas
  // (below the page's chips/button), drawing in the pack's own glyph font,
  // mirroring e1's HUD: district bar + VICE BEACH + timer + finish banner,
  // plus the diagnostics box while loading / on fallback (a phone screenshot
  // must always be able to say which build ran and what failed).
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
    const lines = [`e3 build ${BUILD} — ${err ? "FALLBACK" : "loading " + stage}`];
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
    name: "GTA III (2001)",
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
  if (typeof window !== "undefined") window.__e3 = view;   // tools/evidence handle
  return view;
}
