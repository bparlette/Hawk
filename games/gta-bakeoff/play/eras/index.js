// Era registry. One entry per GTA era; `load` is set only once the era is built.
// To add an era: write play/eras/<id>.js exporting create(canvas, level) -> { draw(sim), dispose() },
// then set its `load` here. Nothing else in the page changes.
//
// MERGED registry (2026-11-16, all 14 eras playable): e1/e2 are Lane A's 2D
// renderers (build stamp 2026-11-16-7, in sync with play/index.html); e3-e8 ride
// the shared 3D engine (play/engine/world3d.js, eras/e3.js shape, Lane B + Lane
// C modules); the six bonus rounds ride the shared 2D renderer
// (play/eras/era2d.js, Lane C). Bonus ids equal their asset folder names
// (assets/bonus-*) because play/engine/audio.js resolves packs as assets/<id>/ —
// do not rename one without the other.
export const ERAS = [
  { id: "e1", n: 1, name: "GTA 1 · 1997",          load: () => import("./e1.js?v=2026-11-16-7") },   // ?v= = build stamp, keep in sync with play/index.html + e1.js
  { id: "e2", n: 2, name: "GTA 2 · 1999",          load: () => import("./e2.js?v=2026-11-16-7") },
  { id: "e3", n: 3, name: "GTA III · 2001",        load: () => import("./e3.js?v=2026-11-16-1") },
  { id: "e4", n: 4, name: "GTA: Vice City · 2002", load: () => import("./e4.js?v=2026-11-16-1") },
  { id: "e5", n: 5, name: "GTA: San Andreas · 2004", load: () => import("./e5.js?v=2026-11-16-1") },
  { id: "e6", n: 6, name: "GTA IV · 2008",         load: () => import("./e6.js?v=2026-11-16-1") },
  { id: "e7", n: 7, name: "GTA V · 2013",          load: () => import("./e7.js?v=2026-11-16-1") },
  { id: "e8", n: 8, name: "GTA VI · 2026",         load: () => import("./e8.js?v=2026-11-16-1") },
  { id: "bonus-minecraft",       n: "B1", name: "Bonus · Minecraft",       load: () => import("./bonus-minecraft.js?v=2026-11-16-lanec-1") },
  { id: "bonus-roblox",          n: "B2", name: "Bonus · Roblox",          load: () => import("./bonus-roblox.js?v=2026-11-16-lanec-1") },
  { id: "bonus-fortnite",        n: "B3", name: "Bonus · Fortnite",        load: () => import("./bonus-fortnite.js?v=2026-11-16-lanec-1") },
  { id: "bonus-lego",            n: "B4", name: "Bonus · LEGO",            load: () => import("./bonus-lego.js?v=2026-11-16-lanec-1") },
  { id: "bonus-animal-crossing", n: "B5", name: "Bonus · Animal Crossing", load: () => import("./bonus-animal-crossing.js?v=2026-11-16-lanec-1") },
  { id: "bonus-sims",            n: "B6", name: "Bonus · The Sims",        load: () => import("./bonus-sims.js?v=2026-11-16-lanec-1") },
];
