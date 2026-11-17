# mask.py — land / water / park classification of the shell window from the supplied sheets.
import numpy as np, math, os
from proj import Sheet, to_geo
REFS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'palm-city', 'shots', 'extension-refs')
def sheets():
    return (Sheet(os.path.join(REFS, 'map-causeway-streets.jpg'), 17, -80.195, -80.150, 25.768, 25.792),
            Sheet(os.path.join(REFS, 'map-downtown-streets.jpg'), 17, -80.205, -80.178, 25.758, 25.792),
            Sheet(os.path.join(REFS, 'sat-overview-corridor.jpg'), 16, -80.205, -80.125, 25.755, 25.800))
def map_class(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    if abs(r - 170) < 16 and abs(g - 211) < 14 and abs(b - 223) < 16: return 0          # OSM water
    if g > r + 14 and g > b + 14 and g > 200: return 2                                    # OSM park / grass greens
    return 1
def sat_class(p):
    r, g, b = int(p[0]), int(p[1]), int(p[2])
    if b > r + 18 and g > r + 12 and r < 110: return 0                                   # bay teal
    if g > r + 8 and g > b + 8: return 2                                                  # vegetation
    return 1
def classify(x0, y0, x1, y1, cell):
    """0 water, 1 land, 2 park — one sample per cell centre; maps where they cover, satellite elsewhere."""
    mc, md, so = sheets()
    nx, ny = int((x1 - x0) / cell), int((y1 - y0) / cell)
    out = np.zeros((ny, nx), 'uint8'); src = np.zeros((ny, nx), 'uint8')
    for j in range(ny):
        for i in range(nx):
            lon, lat = to_geo(x0 + (i + .5) * cell, y0 + (j + .5) * cell)
            for k, s in enumerate((mc, md)):
                if s.covers(lon, lat):
                    px, py = s.px(lon, lat)
                    # 3x3 majority so labels and thin lines don't flip a cell
                    v = [map_class(s.im[int(py) + dy, int(px) + dx]) for dy in (-2, 0, 2) for dx in (-2, 0, 2)]
                    out[j, i] = max(set(v), key=v.count); src[j, i] = k + 1
                    break
            else:
                px, py = so.px(lon, lat)
                v = [sat_class(so.im[int(py) + dy, int(px) + dx]) for dy in (-2, 0, 2) for dx in (-2, 0, 2)]
                out[j, i] = max(set(v), key=v.count); src[j, i] = 3
    return out, src
