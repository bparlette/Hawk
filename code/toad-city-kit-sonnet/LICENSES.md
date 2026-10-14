# Licences

All assets are original and procedural (three.js r160, MIT, loaded by the viewer only).

* Everything in `src/` is original code written for Toad City Baltimore. Geometry is built from three.js primitives, extrusions and lofts;
  every texture is drawn on a `<canvas>` at load. There are no model files, image files, web fonts or network fetches in `src/`.
* three.js r160 (MIT, https://github.com/mrdoob/three.js) is loaded by `viewer.html` from https://unpkg.com/three@0.160.0/ through an import map.
  It is **not** copied into `src/` and is not part of this zip.
* No third-party code, snippets, textures or artwork are used. No MIT / CC0 source needs crediting.
* Real Baltimore names and sign styles (Natty Boh-style beer sign, Utz, Old Bay, harbour water-taxi lettering, arabber colours, crab-house wording)
  are re-drawn from plain text and flat shapes on canvas, as the brief allows. No logo file, photo or traced artwork was used or embedded.
  The names belong to their owners and appear here only to make the fictional Inner Harbor read as the real one.
* `toadcity_kit.js` is the shared kit. The starter zip was missing from the hand-off, so it was rebuilt from Appendix A of the brief (see README, "Kit"). Replace it with the real file; nothing in `src/` depends on the rebuilt parts.
