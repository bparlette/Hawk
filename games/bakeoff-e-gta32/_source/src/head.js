// SHELL SHOCK 3D - Level 1 "Big Apple, 3 A.M." (three.js, vendored). Built by build.py: this head, then code reused verbatim
// from the Shell Shock 16-Bit JS game (audio/music/SFX, cabinet + touch + keyboard + gamepad input, pixel HUD font, select
// screen, enemy/boss AI, combat, specials, props, pickups, atlas tables), then the new 3D world / actors / game / HUD.
// The 16-bit beat-'em-up logic runs unchanged in a local 2D frame laid along each street / tunnel / roof "zone":
// x = px along the zone, y = depth px across it, z = jump height px. The new code maps that frame into the 3D city.
import * as THREE from "./three.module.min.js";
(() => {
  "use strict";
  const MODE = "__MODE__", MODE_NAME = { free: "A: FREE CITY", paper: "B: PAPER CITY", gta: "C: GTA CITY", skyline: "D: SKYLINE CITY", gta32: "E: GTA CITY 32-BIT" }[MODE];
  const GTA = MODE === "gta" || MODE === "gta32", P32 = MODE === "gta32"; // E = C's chase camera + low-poly 32-bit 3D models + 360-degree combat
  const SKY = MODE === "skyline", PAPERISH = MODE === "paper" || SKY; // D = B (paper cutouts, swinging camera) + a low, up-tilted camera and tall buildings
  const W = 384, H = 224;
  const RES = 2; // HUD canvas backing store = 2x the 384x224 world, so the pixel font and painted portraits stay crisp
  const Q = location.search;
  const BOT = /[?&]bot\b/.test(Q), TURBO = Math.max(1, Math.min(12, +((Q.match(/[?&]turbo=(\d+)/) || [])[1] || 1)));
  const SHOT = /[?&]shot=/.test(Q);
  const canvas = document.getElementById("game"); // HUD / menus (2D, transparent) over the WebGL canvas
  const glCanvas = document.getElementById("gl");
  canvas.width = W * RES; canvas.height = H * RES;
  (function () { // FREEZE FIX from the 16-bit game: negative radii never throw
    const C = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype; if (!C || C.__radiusSafe) return; C.__radiusSafe = true;
    const fix = (v) => (v < 0 ? 0 : v), arc = C.arc, ell = C.ellipse;
    C.arc = function (x, y, r, a0, a1, ccw) { return arc.call(this, x, y, fix(r), a0, a1, ccw); };
    if (ell) C.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) { return ell.call(this, x, y, fix(rx), fix(ry), rot, a0, a1, ccw); };
  })();
  let ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const BROTHERS = [
    { name: "LENNY", mask: "#2f6bff", reach: 20, spd: 14, weapon: "katana" },
    { name: "RAFE", mask: "#e8302a", reach: 14, spd: 10, weapon: "sai" },
    { name: "MIKO", mask: "#ff8c1a", reach: 20, spd: 14, weapon: "nunchaku" },
    { name: "DONNY", mask: "#9b3fe0", reach: 28, spd: 20, weapon: "bo" },
  ];
  const STATE = {
    scene: "boot", t: 0, selectIndex: 0, player: null, showTouch: "ontouchstart" in window, muted: false,
    enemies: [], stars: [], fx: [], items: [], props: [], targets: [], zones: [], stop: 0, shake: 0, zoom: 0, score: 0, camX: 0,
    phase: "waves", section: "S", clear: false, cut: null, pizza: null, results: null, clearT: 0, modeT: 0, queue: [], spawnT: 0,
    locked: false, goT: 0, bossT: 0, specT: 0, specName: "", barkCd: 0, pBark: null, kills: 0, playT: 0, tagT: 0, level: 1,
    lives: 3, secrets: 0, ramrodOn: false, bossDown: false, intro: 0,
  };
  let FLOOR_TOP = 150, FLOOR_BOT = 215, LEVEL_W = 4000; // per zone (set by setZone)
  let selWipe = 0, selPick = 0;
  const NRAND = Math.random;
  const curLV = () => null; // reused code: no plugin level, the built-in Level 1 paths
  const curSec = () => null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const ENG_STEP = 1000 / 60;
  const API = {};
  const safe = (fn, dflt) => { try { return fn(); } catch (e) { console.warn("hook error", e); return dflt; } };
  const modeOn = () => false;
  const entrStart = () => {}; // the 2D entrance set pieces are replaced by the 3D intros
  const L1_ENTR = { scorcher: () => null, ramrod: () => null, zaps: () => null };
  const targetHits = () => false; // no level-drawn targets in 3D
  const stepA = (a) => Math.max(0, Math.min(1, Math.round(a * 4) / 4));
