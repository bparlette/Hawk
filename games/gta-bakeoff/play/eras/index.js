// Era registry. One entry per GTA era; `load` is set only once the era is built.
// To add an era: write play/eras/<id>.js exporting create(canvas, level) -> { draw(sim), dispose() },
// then set its `load` here. Nothing else in the page changes.
export const ERAS = [
  { id: "e1", n: 1, name: "GTA 1 · 1997",          load: () => import("./e1.js?v=2026-11-15-6") },   // ?v= = build stamp, keep in sync with play/index.html + e1.js
  { id: "e2", n: 2, name: "GTA 2 · 1999",          load: null },
  { id: "e3", n: 3, name: "GTA III · 2001",        load: null },
  { id: "e4", n: 4, name: "GTA: Vice City · 2002", load: null },
  { id: "e5", n: 5, name: "GTA: San Andreas · 2004", load: null },
  { id: "e6", n: 6, name: "GTA IV · 2008",         load: null },
  { id: "e7", n: 7, name: "GTA V · 2013",          load: null },
  { id: "e8", n: 8, name: "GTA VI · 2026",         load: null },
];
