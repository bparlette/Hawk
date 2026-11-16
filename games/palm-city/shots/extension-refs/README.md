# Palm City world extension — supplied reference imagery (Moth, Nov 16, 2026)

For Fable task 11 (world extension, driving shell). Real Miami
geography for the extension area: Miami Beach west shore ->
MacArthur Causeway -> Watson Island -> downtown waterfront.
The game's current map stays untouched; this is the shell west
of it. Dressing comes from Palm City's own painter/sprites —
these images are GEOGRAPHY source, not a look target.

Sheets (satellite: Esri World Imagery tiles, stitched;
maps: OpenStreetMap tiles, stitched):
- sat-overview-corridor.jpg — z16, lon -80.205..-80.125,
  lat 25.755..25.800. The whole corridor shape.
- sat-causeway-detail.jpg — z17, lon -80.195..-80.150,
  lat 25.768..25.792. Causeway, Watson Island, port bridge.
- sat-downtown-detail.jpg — z17, lon -80.205..-80.178,
  lat 25.758..25.792. Waterfront edge + downtown blocks.
- map-causeway-streets.jpg — z17 street map, same bounds as
  sat-causeway-detail. Trace roads from this.
- map-downtown-streets.jpg — z17 street map, same bounds as
  sat-downtown-detail.

Sample area (task 11, step 1): the causeway + the first
downtown blocks across the bay, per sat-causeway-detail +
sat-downtown-detail. Street View was deliberately NOT
supplied: the shell wears Palm City's own facades, not
replicas of real buildings.
