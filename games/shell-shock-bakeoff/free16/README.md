# F: Free City 16-bit (camera bake-off)

Live: https://shellshock-free16-city.surge.sh

Prototype A (Free City: raised 3/4 camera at 40°, world-aligned smooth follow, R turns 90°, buildings fade when they block the view)
with the same intersection, enemies and combat, drawn with the ORIGINAL Shell Shock 16-Bit pixel sprites instead of the painted ones.

- The 3D scene renders into a small framebuffer (about 270–460 px tall, picked per screen so the browser upscales it by a whole
  number with nearest-neighbour). One framebuffer pixel = one 16-bit game pixel at the hero's depth; the camera keeps A's angle,
  lens and framing and moves its distance to match.
- Sprites: billboards are laid out in whole pixels around their snapped foot point and sample the sheet at art-pixel centres
  (the 16-bit sheets are block art at ~2.44 sheet px per pixel; `_source/pxgrid.json` holds each frame cluster's grid phase).
  Heroes, foot soldiers and bosses draw 1:1; props and pickups keep the 16-bit game's smaller scale.
- The camera snaps to whole framebuffer pixels in its image plane, so the street and sprites step together without shimmer.
- Environment: palette-quantized pixel versions of the city textures, procedural pixel tiles for asphalt, sidewalk and roofs,
  and posterized canvas art (signs, tags, awnings). All filtering is nearest.

Source: `_source/` (`build_f.py` builds `site_f/`; `tools/pxtex.py` makes the pixel textures, `tools/phase.py` the sprite grid table).
