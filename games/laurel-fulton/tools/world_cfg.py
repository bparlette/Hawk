# world_cfg.py — the one place a city's tools get their WORLD from (task L4, the factory):
#   root()  : the build folder — $LF_ROOT if set (the factory points it at a new city), else games/laurel-fulton/
#   bbox()  : [S, W, N, E] — data/world.json in that root if present, else the Laurel/Fulton stage-1 box
#   proj    : lon/lat -> world units (10 / m, x east, y south) about the bbox centre — every tool's projection
import os, json, math
def root():
    return os.environ.get('LF_ROOT') or os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
def bbox():
    p = os.path.join(root(), 'data', 'world.json')
    return json.load(open(p))['bbox'] if os.path.exists(p) else [39.105, -76.942, 39.202, -76.846]
S, W, N, E = bbox()
LAT0, LON0 = (S + N) / 2, (W + E) / 2
KX, KY, U = math.cos(math.radians(LAT0)) * 111320.0, 110540.0, 10.0
def proj(lat, lon): return ((lon - LON0) * KX * U, -(lat - LAT0) * KY * U)
def proj_i(lat, lon): x, y = proj(lat, lon); return (round(x), round(y))
