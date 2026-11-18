// build_extension_facades.mjs — Queue 4 Task 3: World Extension facade + roof variety pack (18 pieces)
// Renders 18 distinct transparent WebP building pieces at 2 px/wu in Palm City's #210f2e ink painted style:
//   - 6 Downtown mid-rises (bld_ext_dt_*)
//   - 6 Causeway-side low blocks (bld_ext_cw_*)
//   - 6 Airport strip pieces (bld_ext_ap_*)
// Deliverables stay strictly inside games/palm-city/shots/extension-facades/ (zero live src/ or assets/ edits).
import { chromium } from '/Users/braidpairlette/Games/Hawk/games/palm-city/tools/node_modules/playwright-core/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'shots', 'extension-facades');
const SCRATCH = path.join(OUT, '_tmp');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CWEBP = fs.existsSync('/opt/homebrew/bin/cwebp') ? '/opt/homebrew/bin/cwebp' : 'cwebp';

const PIECES = [
  // 1. Downtown Mid-Rises
  { id: 'bld_ext_dt_biscayne_tower', group: 'Downtown Mid-Rises', w: 340, h: 320, desc: 'Tiered Art-Deco peach/limestone setback mid-rise w/ turquoise atrium skylight & helipad roof' },
  { id: 'bld_ext_dt_brickell_glass', group: 'Downtown Mid-Rises', w: 380, h: 300, desc: 'Twin-wing cerulean curtain-wall tower block w/ champagne mullions & rooftop solar arrays' },
  { id: 'bld_ext_dt_flagler_deco', group: 'Downtown Mid-Rises', w: 300, h: 280, desc: 'Coral & cream MiMo commercial block w/ scalloped roof parapet, striped marquee & water tank' },
  { id: 'bld_ext_dt_bayfront_hotel', group: 'Downtown Mid-Rises', w: 420, h: 270, desc: 'L-shaped bayfront resort mid-rise w/ terracotta barrel-tile terrace & sapphire courtyard deck' },
  { id: 'bld_ext_dt_metro_bank', group: 'Downtown Mid-Rises', w: 320, h: 320, desc: 'Chamfered octal stone plaza block w/ bronze skylight lantern & perimeter fins' },
  { id: 'bld_ext_dt_marina_condo', group: 'Downtown Mid-Rises', w: 440, h: 250, desc: 'Terraced waterfront condo bar w/ curved seafoam balcony ledges & twin penthouses' },
  // 2. Causeway-Side Low Blocks
  { id: 'bld_ext_cw_yacht_club', group: 'Causeway Low Blocks', w: 360, h: 240, desc: 'Stucco island yacht clubhouse w/ standing-seam teal hipped roof & harbor timber canopy' },
  { id: 'bld_ext_cw_ferry_terminal', group: 'Causeway Low Blocks', w: 460, h: 210, desc: 'Sawtooth Watson Island ferry concourse w/ vaulted turquoise skylights & boarding awnings' },
  { id: 'bld_ext_cw_tiki_bar', group: 'Causeway Low Blocks', w: 260, h: 220, desc: 'Octagonal palm-thatch tiki pavilion joined to coral-stucco bar annex & wooden deck apron' },
  { id: 'bld_ext_cw_bait_tackle', group: 'Causeway Low Blocks', w: 240, h: 190, desc: 'Weathered mint & driftwood causeway bait shop w/ ribbed metal shed roof & striped awning' },
  { id: 'bld_ext_cw_seaplane_base', group: 'Causeway Low Blocks', w: 390, h: 250, desc: 'Watson Island arched barrel seaplane terminal w/ checkered beacon & bay-door apron' },
  { id: 'bld_ext_cw_boathouse', group: 'Causeway Low Blocks', w: 310, h: 220, desc: 'Twin-bay coral-trim marina dry-stack shed w/ sliding gantry rails & translucent panels' },
  // 3. Airport Strip Pieces
  { id: 'bld_ext_ap_concourse', group: 'Airport Strip', w: 520, h: 240, desc: 'Ribbed cream concrete terminal concourse spine w/ 4 cantilevered jetways & blue observation glass' },
  { id: 'bld_ext_ap_control_tower', group: 'Airport Strip', w: 240, h: 240, desc: 'Flared airport tower base w/ octal green-tinted ATC glass cab & catwalk rail' },
  { id: 'bld_ext_ap_hangar_tropics', group: 'Airport Strip', w: 440, h: 310, desc: 'Arched barrel aviation hangar w/ sunburst gold racing stripes & parted steel doors' },
  { id: 'bld_ext_ap_cargo_depot', group: 'Airport Strip', w: 480, h: 220, desc: 'Long flat air-freight strip block w/ 6 loading bays, hazard bumpers & turbine vents' },
  { id: 'bld_ext_ap_rental_plaza', group: 'Airport Strip', w: 360, h: 210, desc: 'Googie boomerang car-rental check-in canopy w/ Miami teal fins & island kiosks' },
  { id: 'bld_ext_ap_radar_station', group: 'Airport Strip', w: 220, h: 220, desc: 'White geodesic dome radar bunker on octal concrete pad w/ aviation red beacon' },
];

const DRAW_SCRIPT = `
(() => {
  const INK = '#210f2e';
  function roundPath(g, x, y, w, h, r) {
    g.beginPath(); g.roundRect(x, y, w, h, r);
  }
  function box(g, x, y, w, h, fill, inkW = 2.6, r = 4) {
    g.fillStyle = fill; roundPath(g, x, y, w, h, r); g.fill();
    g.strokeStyle = INK; g.lineWidth = inkW; roundPath(g, x, y, w, h, r); g.stroke();
  }
  function parapet(g, x, y, w, h, rimCol, innerCol, thickness = 12, r = 5) {
    box(g, x, y, w, h, rimCol, 2.8, r);
    // Warm sunlit WSW highlights + cool shadow ENE inner crease (matches Palm City 255 deg sun)
    g.strokeStyle = 'rgba(255,248,224,0.65)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(x + r, y + h - 3); g.lineTo(x + r, y + 3); g.lineTo(x + w - r, y + 3); g.stroke();
    box(g, x + thickness, y + thickness, w - thickness * 2, h - thickness * 2, innerCol, 2.2, Math.max(2, r - 2));
  }
  function roofGrain(g, x, y, w, h, seed, alpha = 0.08) {
    g.save(); roundPath(g, x, y, w, h, 3); g.clip();
    let s = seed * 9973 + 17;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 65; i++) {
      g.fillStyle = rnd() > 0.5 ? \`rgba(255,248,224,\${alpha})\` : \`rgba(33,15,46,\${alpha})\`;
      const rx = x + rnd() * w, ry = y + rnd() * h, rw = 10 + rnd() * 26, rh = 2 + rnd() * 3.5;
      g.fillRect(rx, ry, rw, rh);
    }
    g.restore();
  }
  function hvac(g, x, y, w, h, fans = 1) {
    box(g, x, y, w, h, '#c9d2da', 2.0, 3);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.4;
    g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    for (let i = 0; i < fans; i++) {
      const cx = x + (i + 0.5) * (w / fans), cy = y + h / 2, rad = Math.min(w / fans, h) * 0.30;
      g.fillStyle = '#332b42'; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = '#9aa6b4'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx - rad * 0.7, cy); g.lineTo(cx + rad * 0.7, cy); g.moveTo(cx, cy - rad * 0.7); g.lineTo(cx, cy + rad * 0.7); g.stroke();
    }
  }
  function sideWall(g, x, y, w, h, wallBot, wallRight) {
    // 2.5D south/east skirt thickness cues aligned with Palm City top-down ortho extrusion
    g.fillStyle = wallBot;
    g.beginPath(); g.moveTo(x + 2, y + h); g.lineTo(x + w - 2, y + h); g.lineTo(x + w + 12, y + h + 14); g.lineTo(x + 14, y + h + 14); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
    g.fillStyle = wallRight;
    g.beginPath(); g.moveTo(x + w, y + 2); g.lineTo(x + w + 14, y + 14); g.lineTo(x + w + 12, y + h + 14); g.lineTo(x + w, y + h); g.closePath(); g.fill();
    g.stroke();
  }
  function skylight(g, x, y, w, h, glass = '#47a8c9') {
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, '#96ebff'); gr.addColorStop(0.55, glass); gr.addColorStop(1, '#265c78');
    box(g, x, y, w, h, gr, 2.2, 4);
    g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 1.6;
    for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + w * k / 4, y + 2); g.lineTo(x + w * k / 4, y + h - 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + w * 0.45, y + 4); g.lineTo(x + w * 0.18, y + h - 4); g.lineTo(x + 4, y + h - 4); g.closePath(); g.fill();
  }
  function awningStripes(g, x, y, w, h, c1, c2, n = 8) {
    box(g, x, y, w, h, c1, 2.0, 2);
    g.save(); roundPath(g, x, y, w, h, 2); g.clip();
    g.fillStyle = c2;
    for (let i = 0; i < n; i += 2) g.fillRect(x + i * (w / n), y, w / n, h);
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 2.0; roundPath(g, x, y, w, h, 2); g.stroke();
  }

  window.renderPiece = function(id, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const pad = 18;
    const rx = pad, ry = pad, rw = w - pad * 2 - 14, rh = h - pad * 2 - 14;

    if (id === 'bld_ext_dt_biscayne_tower') {
      sideWall(g, rx, ry, rw, rh, '#c48f6c', '#9c6c56');
      parapet(g, rx, ry, rw, rh, '#f5d9b0', '#e3be92', 14, 6);
      roofGrain(g, rx + 14, ry + 14, rw - 28, rh - 28, 1);
      // Setback upper tier
      sideWall(g, rx + 42, ry + 38, rw - 92, rh - 88, '#b88264', '#8e604e');
      parapet(g, rx + 42, ry + 38, rw - 92, rh - 88, '#ffebd0', '#d8b48a', 10, 5);
      skylight(g, rx + 66, ry + 62, 86, 48, '#3ca0bf');
      // Helipad ring
      const hx = rx + rw - 95, hy = ry + rh - 95;
      g.fillStyle = '#565c6e'; g.beginPath(); g.arc(hx, hy, 38, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
      g.strokeStyle = '#ffd45c'; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy, 28, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#fff4d8'; g.font = '900 28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', hx, hy + 1);
      hvac(g, rx + 26, ry + rh - 58, 72, 34, 2);
    } else if (id === 'bld_ext_dt_brickell_glass') {
      // Twin-wing glass tower + connecting atrium bridge
      sideWall(g, rx, ry, rw, 98, '#557d99', '#3d5d76');
      parapet(g, rx, ry, rw, 98, '#cde4f0', '#648ba4', 10, 6);
      sideWall(g, rx, ry + rh - 102, rw, 102, '#557d99', '#3d5d76');
      parapet(g, rx, ry + rh - 102, rw, 102, '#cde4f0', '#648ba4', 10, 6);
      skylight(g, rx + 44, ry + 92, rw - 88, rh - 184, '#4cc4e0');
      roofGrain(g, rx + 12, ry + 12, rw - 24, 74, 2, 0.06);
      // Solar banks + twin chillers
      for (let i = 0; i < 3; i++) skylight(g, rx + 24 + i * 56, ry + 24, 46, 50, '#2a4f78');
      hvac(g, rx + rw - 122, ry + 26, 94, 46, 3);
      for (let i = 0; i < 4; i++) skylight(g, rx + 26 + i * 68, ry + rh - 76, 56, 48, '#2a4f78');
    } else if (id === 'bld_ext_dt_flagler_deco') {
      sideWall(g, rx, ry, rw, rh, '#c46c5e', '#984e48');
      parapet(g, rx, ry, rw, rh, '#ffe2cf', '#e8967d', 14, 16);
      roofGrain(g, rx + 16, ry + 16, rw - 32, rh - 32, 3);
      // MiMo coral fins + central neon skylight band + water tank
      box(g, rx + 30, ry + 36, rw - 60, 42, '#fff4de', 2.4, 8);
      awningStripes(g, rx + 24, ry + rh - 12, rw - 48, 22, '#ff6e54', '#fff4e0', 10);
      skylight(g, rx + 44, ry + 96, rw - 110, 46, '#48b8c9');
      g.fillStyle = '#c89a66'; g.beginPath(); g.arc(rx + rw - 54, ry + rh - 64, 24, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.4; g.stroke();
      g.fillStyle = '#d8664e'; g.beginPath(); g.arc(rx + rw - 54, ry + rh - 64, 12, 0, Math.PI * 2); g.fill(); g.stroke();
      hvac(g, rx + 34, ry + rh - 78, 66, 36, 2);
    } else if (id === 'bld_ext_dt_bayfront_hotel') {
      // Sapphire courtyard deck at lower-right + L-wing hotel
      box(g, rx + 90, ry + 78, rw - 90, rh - 78, '#e8d4b2', 2.6, 6);
      skylight(g, rx + 135, ry + 106, rw - 170, rh - 134, '#24b4d9');
      sideWall(g, rx, ry, rw, 84, '#b86852', '#8f4c3e');
      parapet(g, rx, ry, rw, 84, '#f5d2b0', '#c85e46', 10, 4);
      sideWall(g, rx, ry, 102, rh, '#b86852', '#8f4c3e');
      parapet(g, rx, ry, 102, rh, '#f5d2b0', '#c85e46', 10, 4);
      // Barrel-tile ridge ribs
      g.strokeStyle = 'rgba(255,244,218,0.35)'; g.lineWidth = 2;
      for (let x = rx + 18; x < rx + rw - 18; x += 14) { g.beginPath(); g.moveTo(x, ry + 12); g.lineTo(x, ry + 72); g.stroke(); }
      hvac(g, rx + 20, ry + rh - 76, 60, 48, 2);
    } else if (id === 'bld_ext_dt_metro_bank') {
      // Chamfered octagon fortress bank
      const c = 34;
      const traceOct = (ox, oy, inset = 0) => {
        const x0 = rx + ox + inset, y0 = ry + oy + inset, w0 = rw - inset * 2, h0 = rh - inset * 2;
        g.beginPath();
        g.moveTo(x0 + c, y0); g.lineTo(x0 + w0 - c, y0); g.lineTo(x0 + w0, y0 + c); g.lineTo(x0 + w0, y0 + h0 - c);
        g.lineTo(x0 + w0 - c, y0 + h0); g.lineTo(x0 + c, y0 + h0); g.lineTo(x0, y0 + h0 - c); g.lineTo(x0, y0 + c); g.closePath();
      };
      g.fillStyle = '#8b7a78'; traceOct(10, 12); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
      g.fillStyle = '#dfd2bc'; traceOct(0, 0); g.fill(); g.stroke();
      g.fillStyle = '#b4a592'; traceOct(0, 0, 16); g.fill(); g.stroke();
      roofGrain(g, rx + 20, ry + 20, rw - 40, rh - 40, 5);
      box(g, rx + 58, ry + 58, rw - 116, rh - 116, '#928378', 2.4, 6);
      skylight(g, rx + 80, ry + 80, rw - 160, rh - 160, '#a87d44');
      hvac(g, rx + 42, ry + 26, 48, 26, 2);
    } else if (id === 'bld_ext_dt_marina_condo') {
      sideWall(g, rx, ry, rw, rh, '#729998', '#527376');
      parapet(g, rx, ry, rw, rh, '#e6f5ee', '#b2d8d0', 12, 10);
      roofGrain(g, rx + 14, ry + 14, rw - 28, rh - 28, 6);
      // Twin stepped penthouses + ribbed terrace fins along south facade
      for (const px of [rx + 36, rx + rw - 170]) {
        sideWall(g, px, ry + 26, 134, rh - 76, '#5f8588', '#426066');
        parapet(g, px, ry + 26, 134, rh - 76, '#fff8e8', '#7fb8b6', 9, 6);
        skylight(g, px + 24, ry + 48, 86, 44, '#56c2d6');
      }
      for (let x = rx + 28; x < rx + rw - 28; x += 26) box(g, x, ry + rh - 22, 16, 14, '#fff8ea', 1.8, 3);
    } else if (id === 'bld_ext_cw_yacht_club') {
      sideWall(g, rx, ry, rw, rh, '#b89e82', '#947a62');
      // Hip roof in signature Miami teal metal seam
      box(g, rx, ry, rw, rh, '#329e9a', 2.8, 6);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
      for (let x = rx + 16; x < rx + rw - 12; x += 18) { g.beginPath(); g.moveTo(x, ry + 4); g.lineTo(x, ry + rh - 4); g.stroke(); }
      g.strokeStyle = INK; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + 64, ry + 56); g.moveTo(rx + rw, ry); g.lineTo(rx + rw - 64, ry + 56);
      g.moveTo(rx, ry + rh); g.lineTo(rx + 64, ry + rh - 56); g.moveTo(rx + rw, ry + rh); g.lineTo(rx + rw - 64, ry + rh - 56);
      g.moveTo(rx + 64, ry + 56); g.lineTo(rx + rw - 64, ry + 56); g.lineTo(rx + rw - 64, ry + rh - 56); g.lineTo(rx + 64, ry + rh - 56); g.closePath(); g.stroke();
      box(g, rx + 72, ry + rh - 10, rw - 144, 24, '#d9b07e', 2.2, 3);
      awningStripes(g, rx + 96, ry + rh - 6, rw - 192, 16, '#224f7c', '#fff6e4', 10);
    } else if (id === 'bld_ext_cw_ferry_terminal') {
      sideWall(g, rx, ry, rw, rh, '#9c8a7c', '#76665e');
      box(g, rx, ry, rw, rh, '#f0dec2', 2.8, 6);
      const bays = 4, bw = (rw - 24) / bays;
      for (let i = 0; i < bays; i++) {
        const bx = rx + 12 + i * bw;
        box(g, bx + 4, ry + 14, bw - 8, rh - 28, i % 2 ? '#e6c9a2' : '#d8b78f', 2.2, 4);
        skylight(g, bx + 14, ry + 26, bw - 28, rh - 52, '#3ebad4');
      }
      awningStripes(g, rx + 36, ry + rh - 10, rw - 72, 18, '#ffb02e', '#fff6e4', 12);
    } else if (id === 'bld_ext_cw_tiki_bar') {
      // Wooden boardwalk apron + coral bar rect + octagonal palm thatch pavilion
      box(g, rx, ry + 34, rw, rh - 34, '#b88656', 2.4, 6);
      for (let y = ry + 44; y < ry + rh - 6; y += 14) { g.strokeStyle = 'rgba(33,15,46,0.28)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(rx + 6, y); g.lineTo(rx + rw - 6, y); g.stroke(); }
      parapet(g, rx + rw - 96, ry + 14, 86, rh - 44, '#ffab8e', '#e87a62', 8, 5);
      const cx = rx + 68, cy = ry + rh / 2, rad = 64;
      g.fillStyle = '#c99c4e'; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.8; g.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); g.stroke(); }
      g.fillStyle = '#8b5e2e'; g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (id === 'bld_ext_cw_bait_tackle') {
      sideWall(g, rx, ry + 10, rw, rh - 10, '#6a8e80', '#4f6e66');
      box(g, rx, ry + 10, rw, rh - 18, '#8ec2ab', 2.8, 5);
      g.strokeStyle = 'rgba(33,15,46,0.32)'; g.lineWidth = 2.0;
      for (let x = rx + 12; x < rx + rw - 8; x += 14) { g.beginPath(); g.moveTo(x, ry + 12); g.lineTo(x, ry + rh - 10); g.stroke(); }
      box(g, rx + rw - 52, ry + 28, 34, 24, '#e8eef2', 2.0, 3);
      awningStripes(g, rx + 16, ry + rh - 16, rw - 32, 20, '#d94f3d', '#fff4de', 8);
    } else if (id === 'bld_ext_cw_seaplane_base') {
      sideWall(g, rx, ry, rw, rh, '#887e74', '#635c5a');
      box(g, rx, ry, rw, rh, '#e8e4dc', 2.8, 12);
      // Vaulted aviation barrel ribs + teal stripes + checkered control cube
      g.fillStyle = '#3aa0b8'; g.fillRect(rx + 4, ry + 26, rw - 8, 22); g.fillRect(rx + 4, ry + rh - 48, rw - 8, 22);
      g.strokeStyle = INK; g.lineWidth = 2.2;
      for (let x = rx + 26; x < rx + rw - 20; x += 28) { g.beginPath(); g.moveTo(x, ry + 4); g.lineTo(x, ry + rh - 4); g.stroke(); }
      box(g, rx + rw - 76, ry + 28, 54, 54, '#ffb02e', 2.4, 4);
      g.fillStyle = INK; g.fillRect(rx + rw - 76, ry + 28, 27, 27); g.fillRect(rx + rw - 49, ry + 55, 27, 27);
    } else if (id === 'bld_ext_cw_boathouse') {
      sideWall(g, rx, ry, rw, rh, '#b86d58', '#8a4c42');
      box(g, rx, ry, rw, rh, '#e69578', 2.6, 5);
      for (let i = 0; i < 2; i++) {
        const y0 = ry + 16 + i * ((rh - 42) / 2 + 10), bh = (rh - 42) / 2;
        box(g, rx + 12, y0, rw - 24, bh, '#c95c48', 2.2, 4);
        skylight(g, rx + 30, y0 + 10, rw - 60, bh - 20, '#80d8ea');
      }
    } else if (id === 'bld_ext_ap_concourse') {
      // Concourse spine + 4 cantilevered boarding bridges along bottom apron edge
      for (let i = 0; i < 4; i++) {
        const jx = rx + 44 + i * ((rw - 88) / 3) - 14;
        box(g, jx, ry + rh - 24, 28, 44, '#d9d4cc', 2.2, 3);
        box(g, jx - 4, ry + rh + 10, 36, 12, '#3a4659', 2.0, 2);
      }
      sideWall(g, rx, ry, rw, rh - 20, '#998f88', '#766f6c');
      parapet(g, rx, ry, rw, rh - 20, '#f4ecdc', '#d2c8b8', 12, 8);
      roofGrain(g, rx + 14, ry + 14, rw - 28, rh - 48, 13);
      skylight(g, rx + 26, ry + 26, rw - 52, 36, '#4fa9c9');
      for (let i = 0; i < 3; i++) hvac(g, rx + 50 + i * 145, ry + rh - 76, 62, 30, 2);
    } else if (id === 'bld_ext_ap_control_tower') {
      sideWall(g, rx + 24, ry + 24, rw - 48, rh - 48, '#a69686', '#82746a');
      parapet(g, rx + 24, ry + 24, rw - 48, rh - 48, '#f0dec2', '#c8b8a2', 12, 10);
      const cx = rx + rw / 2, cy = ry + rh / 2;
      g.fillStyle = '#332b42'; g.beginPath(); g.arc(cx, cy, 56, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
      g.fillStyle = '#47c2a8'; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(cx, cy, 32, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffb02e'; g.fillRect(cx - 16, cy - 4, 32, 8); g.strokeRect(cx - 16, cy - 4, 32, 8);
    } else if (id === 'bld_ext_ap_hangar_tropics') {
      sideWall(g, rx, ry, rw, rh, '#8f7d6a', '#6a5b52');
      box(g, rx, ry, rw, rh, '#efe9df', 2.8, 10);
      roofGrain(g, rx + 10, ry + 10, rw - 20, rh - 20, 15, 0.06);
      g.fillStyle = '#ff9f2e'; g.fillRect(rx + 6, ry + rh * 0.24, rw - 12, 24);
      g.fillStyle = '#e84c3d'; g.fillRect(rx + 6, ry + rh * 0.24 + 24, rw - 12, 12);
      g.strokeStyle = INK; g.lineWidth = 2.2;
      for (let x = rx + 28; x < rx + rw - 20; x += 32) { g.beginPath(); g.moveTo(x, ry + 6); g.lineTo(x, ry + rh - 6); g.stroke(); }
      box(g, rx + 30, ry + rh - 12, rw - 60, 20, '#444858', 2.4, 2);
      g.strokeStyle = '#ffd45c'; g.lineWidth = 2; g.beginPath(); g.moveTo(rx + 36, ry + rh + 4); g.lineTo(rx + rw - 36, ry + rh + 4); g.stroke();
    } else if (id === 'bld_ext_ap_cargo_depot') {
      sideWall(g, rx, ry, rw, rh, '#787e88', '#565c68');
      parapet(g, rx, ry, rw, rh, '#e2e4e8', '#b0b5be', 10, 4);
      roofGrain(g, rx + 12, ry + 12, rw - 24, rh - 24, 16);
      for (let i = 0; i < 6; i++) {
        const dx = rx + 24 + i * ((rw - 48) / 6);
        box(g, dx + 4, ry + rh - 10, (rw - 48) / 6 - 10, 18, '#ffb02e', 2.0, 2);
        hvac(g, dx + 10, ry + 26, 34, 28, 1);
      }
      box(g, rx + 26, ry + 78, rw - 52, 34, '#8d949e', 2.0, 3);
    } else if (id === 'bld_ext_ap_rental_plaza') {
      // Mid-century boomerang canopy
      box(g, rx + 18, ry + 36, rw - 36, rh - 48, '#8a868c', 2.4, 4);
      g.fillStyle = '#3dbab0'; g.strokeStyle = INK; g.lineWidth = 2.8;
      g.beginPath();
      g.moveTo(rx, ry + 18); g.quadraticCurveTo(rx + rw / 2, ry - 8, rx + rw, ry + 18);
      g.lineTo(rx + rw - 16, ry + rh - 28); g.quadraticCurveTo(rx + rw / 2, ry + rh - 52, rx + 16, ry + rh - 28);
      g.closePath(); g.fill(); g.stroke();
      box(g, rx + 44, ry + 26, rw - 88, 38, '#fff2cf', 2.2, 6);
      box(g, rx + 94, ry + rh - 26, rw - 188, 22, '#ff7258', 2.0, 4);
    } else if (id === 'bld_ext_ap_radar_station') {
      box(g, rx + 12, ry + 12, rw - 24, rh - 24, '#7a7882', 2.4, 8);
      parapet(g, rx + 24, ry + 24, rw - 48, rh - 48, '#d4d0c8', '#98948e', 10, 6);
      const cx = rx + rw / 2, cy = ry + rh / 2, rad = 52;
      const gr = g.createRadialGradient(cx - 16, cy - 16, 4, cx, cy, rad);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#dde2ea'); gr.addColorStop(1, '#8f98aa');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.6; g.stroke();
      g.strokeStyle = 'rgba(33,15,46,0.28)'; g.lineWidth = 1.4;
      for (const ang of [0, Math.PI / 3, -Math.PI / 3]) { g.beginPath(); g.ellipse(cx, cy, rad * 0.45, rad, ang, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#ff4238'; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    }
    return cv.toDataURL('image/png');
  };
})();
`;

const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: DRAW_SCRIPT });

const rows = [];
for (const p of PIECES) {
  const dataUrl = await page.evaluate(({ id, w, h }) => window.renderPiece(id, w, h), p);
  const pngPath = path.join(SCRATCH, `${p.id}.png`);
  const webpPath = path.join(OUT, `${p.id}.webp`);
  fs.writeFileSync(pngPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  execFileSync(CWEBP, ['-quiet', '-q', '92', '-alpha_q', '100', pngPath, '-o', webpPath]);
  rows.push({
    ...p,
    wuW: +(p.w / 2).toFixed(1),
    wuH: +(p.h / 2).toFixed(1),
    ox: -(p.w / 2),
    oy: -(p.h / 2),
    bytes: fs.statSync(webpPath).size,
  });
}

// Contact sheet
const groups = ['Downtown Mid-Rises', 'Causeway Low Blocks', 'Airport Strip'];
const b64 = (id) => 'data:image/png;base64,' + fs.readFileSync(path.join(SCRATCH, `${id}.png`)).toString('base64');
const sheet = await browser.newPage({ viewport: { width: 1520, height: 1450 }, deviceScaleFactor: 1 });
await sheet.setContent(`
  <html><body style="margin:0;background:#1a0f29;color:#fff4de;font-family:'Avenir Next',system-ui,sans-serif;padding:20px;">
    <div style="text-align:center;font-weight:900;font-size:22px;color:#ffd45c;margin-bottom:6px;">
      PALM CITY WORLD EXTENSION — 18 FACADE & ROOF VARIETY PIECES (2 px/wu, #210f2e INK)
    </div>
    <div style="text-align:center;font-size:12px;color:#b8e8ff;margin-bottom:16px;">
      Downtown Mid-Rises · Causeway Low Blocks · Airport Strip — Zero Core Overrides
    </div>
    ${groups.map(grp => `
      <div style="font-weight:900;font-size:14px;color:#ff9f7f;margin:12px 0 8px;border-bottom:1px solid #44315e;padding-bottom:4px;">${grp.toUpperCase()}</div>
      <div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:12px;margin-bottom:10px;">
        ${rows.filter(r => r.group === grp).map(r => `
          <div style="background:#26183b;border:1.5px solid #4f3a6e;border-radius:10px;padding:8px;text-align:center;">
            <div style="height:150px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#382552,#241538);border-radius:6px;margin-bottom:6px;">
              <img src="${b64(r.id)}" style="max-width:100%;max-height:142px;object-fit:contain;"/>
            </div>
            <div style="font-weight:800;font-size:11px;color:#ffd45c;">${r.id.replace('bld_ext_', '')}</div>
            <div style="font-size:10px;color:#cbb8de;">${r.w}×${r.h} px (${r.wuW}×${r.wuH} wu)</div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </body></html>
`);
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: path.join(OUT, 'extension-facades-sheet.png'), fullPage: true });
await sheet.close();
await browser.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });

// SPRITES.md
const md = [
  '# World Extension Facade + Roof Variety Pack (`Queue 4 Task 3`)',
  '',
  '> `18` distinct transparent WebP building pieces at Palm City\'s exact `2 px / wu` scale with `#210f2e` dark-plum ink contours and 255° WSW sunlit bevel cues. Built for Fable task 11 (`shell_layout.json`); zero edits to core `src/` or `assets/`.',
  '',
  '## 1. Audit Summary (Before Baking)',
  '',
  '- **Existing Core Buildings (`assets/manifest.json` -> `buildings`):** `16` sprites (`apartments`, `club`, `diner`, `garage`, `hospital`, `hotel`, `house1..3`, `motel`, `office`, `police`, `shops`, `villa1..3`), all `2 px / wu`, `ox = -w/2`, `oy = -h/2`, `240..480 px` wide.',
  '- **Extension Reference Geography (`shots/extension-refs/`):** `README.md` + `sat-overview-corridor.jpg`, `sat-causeway-detail.jpg`, `sat-downtown-detail.jpg`, `map-causeway-streets.jpg`, `map-downtown-streets.jpg` (Miami Beach west shore -> MacArthur Causeway -> Watson Island -> downtown waterfront + airport strip). Per README, real Street View was skipped intentionally so the shell matches Palm City\'s painted aesthetic.',
  '',
  '## 2. Manifest Metrics (`2 px / wu`)',
  '',
  '| Sprite File | Group | Pixel Size (`w×h`) | World Footprint (`wu`) | Origin (`ox, oy`) | KB | Visual Summary |',
  '|---|---|---:|---:|---:|---:|---|',
  ...rows.map(r => `| \`${r.id}.webp\` | ${r.group} | \`${r.w}×${r.h}\` | \`${r.wuW}×${r.wuH}\` | \`${r.ox}, ${r.oy}\` | ${(r.bytes / 1024).toFixed(1)} | ${r.desc} |`),
  '',
  '## 3. Contact Sheet',
  '',
  '- [extension-facades-sheet.png](file://' + path.join(OUT, 'extension-facades-sheet.png') + ')',
  '- **Rebuild:** `node tools/build_extension_facades.mjs` (from `games/palm-city/`)',
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'SPRITES.md'), md);
console.log(`EXTENSION FACADES COMPLETE: ${rows.length} WebPs + SPRITES.md + extension-facades-sheet.png`);
