// Era registry. One entry per rendering generation; `load` is set only once the era is built.
// To add an era: write play/eras/<id>.js exporting create(canvas, level) -> { draw(sim), dispose() },
// then set its `load` here. Nothing else in the page changes.
export const ERAS = [
  { id: "e1", n: 1, name: "8-bit top-down",     load: () => import("./e1.js") },
  { id: "e2", n: 2, name: "16-bit top-down",    load: null },
  { id: "e3", n: 3, name: "Early low-poly 3D",  load: null },
  { id: "e4", n: 4, name: "Cel-shaded 3D",      load: null },
  { id: "e5", n: 5, name: "Warm-haze 3D",       load: null },
  { id: "e6", n: 6, name: "Gritty HD",          load: null },
  { id: "e7", n: 7, name: "Clean HD",           load: null },
  { id: "e8", n: 8, name: "Photoreal neon",     load: null },
];
