## Delivery and self-test

**Make one zip per task:** `toadcity_task<LETTER>_<short-name>_v<N>.zip`, laid out like this:
```
src/                  your modules (snake_case file names, e.g. gang_harbor_rats.js, boss_raven_king.js, rowkit_rowhouse.js)
toadcity_kit.js       the kit, byte-identical to the one you were given
viewer.html           your test bench (start from the kit's viewer.html): imports ./src/*.js, ?show=<id>, ?night=1, ?pose=…
previews/             <asset_id>_day.png and <asset_id>_night.png at 1280x720, plus <group>_phone_390x844.png
README.md             exports, how to view, the MEASURED budget table (parts, tris, draw calls, materials), known issues
LICENSES.md           "All original, procedural" or credits (name, URL, licence) for any MIT / CC0 source used
```

**Self-test loop** (run it for every asset before you move to the next):

1. Serve the folder (`python3 -m http.server 8000`) and open `viewer.html?show=<id>`. Check day, then press N for night, then P to cycle poses.
2. Read the corner readout. **Draw calls and triangles must be inside the budget** for the asset type. Count your materials too.
3. Look at the asset at gameplay distance in a 390×844 window, the iPhone portrait view. The silhouette must read at about 6–10 m away.
4. Take screenshots. Headless Chrome works with `--use-gl=swiftshader`; wait for `window.__ready === true`, then save the `previews/` PNGs.
5. The console must show zero errors. Fix the asset before you move on.

**Do not send:** model or image files (GLB, OBJ, FBX, PNG/JPG textures), minified code, copies of three.js, or anything with an unclear licence.
