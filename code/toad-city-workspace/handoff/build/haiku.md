# Haiku helper prompts (Claude Haiku, low effort)

Use these only on **finished, QA-passed** Sonnet modules. Haiku makes variations and tidies files. It never changes geometry logic, budgets or interfaces. Paste the module source after each prompt.

**H1: Colour variants**
```
Here is a finished Toad City module (three.js, no imports, uses K). Add an exported const COLOR_VARIANTS = [ … ] with
6 colour sets for the colour options it already reads from opts (do not add new options). Use ONLY these hexes:
#8a4a3a #6f6a62 #9a6a44 #5a4f5c #4f5a52 #a4907a #c9b48a #b8a27a #9ab0b8 #c49a9a #2f5a3a #2c322e #eae6dc.
Never use #000000 or #ffffff. Change nothing else. Return the full file.
```

**H2: Window variants**
```
In this rowhouse module, add 3 extra window styles to the existing window option list (e.g. 2/2 sash, arched lintel,
shuttered). Reuse the existing window function and its out.solid / out.glow calls; keep each new style within the
same triangle count as the current window (±10%). Return only the changed functions and the new option names.
```

**H3: Sign text variants**
```
This module draws shop/bar signs on canvas tiles. Add 8 more sign texts that fit Baltimore corner businesses
(e.g. "CARRYOUT", "SUBS & PIZZA", "LIQUORS", "BAIT & TACKLE", Natty Boh-style beer signs, Utz and Old Bay window
signs). Real Baltimore names and sign styles are allowed; redraw them on canvas, never paste logo image files. Keep the same font stack, colours and tile size. Return the updated tile list.
```

**H4: Trim and cornice variants**
```
Add 4 cornice / trim colour + bracket-count presets to this module's opts (bracket counts 4–8, colours from the
palette above). Keep geometry code unchanged; only add presets and a one-line comment each. Return the full file.
```

**H5: Tidy file names and README**
```
Rename files in this delivery to snake_case with the task prefix (rowkit_, props_, veh_), update every reference in
viewer.html and README.md, and rewrite README.md to this outline: 1) Exports (name, signature, one line each)
2) How to view (viewer.html URLs) 3) Measured budget table (copy numbers, do not invent) 4) Variants 5) Known issues.
Do not change any code inside the modules. List every rename you made.
```

**H6: Licence check**
```
Read these files. List every external source, URL, or copied snippet you can find. If there are none, write
LICENSES.md as "All assets are original and procedural (three.js r160, MIT, loaded by the viewer only)."
If there are some, list name, URL, licence; flag anything that is not MIT or CC0.
```
