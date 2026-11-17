# proj.py — the one projection used by tools/geo_to_layout.py: real lon/lat <-> Palm City world units.
# Web-Mercator metres, uniformly scaled by S units per ground metre, anchored so that the point where the
# MacArthur Causeway meets Miami Beach (5th St) lands on the core's west link road (y = 1280).
import math
S = 2.0 / 3.0                 # world units per real metre (the core is 10 u/m: the shell is compressed 15:1)
LON0 = -80.1395               # this meridian is the core's west edge, x = 0
LAT_C, Y_C = 25.7742, 1280.0  # 5th St & Alton Rd  ->  the link road's centreline
R = 6378137.0
def _my(lat): return R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
K = math.cos(math.radians(LAT_C))          # mercator -> ground metres at this latitude
def to_world(lon, lat):
    return (math.radians(lon - LON0) * R * K * S, Y_C - (_my(lat) - _my(LAT_C)) * K * S)
def to_geo(x, y):
    lon = LON0 + math.degrees(x / (R * K * S))
    m = _my(LAT_C) + (Y_C - y) / (K * S)
    return (lon, math.degrees(2 * math.atan(math.exp(m / R)) - math.pi / 2))
# A stitched tile sheet: stated bounds snap outward to whole tiles at zoom z (256 px tiles).
class Sheet:
    def __init__(self, path, z, lon_w, lon_e, lat_s, lat_n):
        from PIL import Image
        import numpy as np
        self.im = np.asarray(Image.open(path).convert('RGB')).astype('int16')
        n = 2 ** z
        tx = lambda lon: (lon + 180) / 360 * n
        ty = lambda lat: (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
        self.tx, self.ty = tx, ty
        self.x0, self.y0 = math.floor(tx(lon_w)), math.floor(ty(lat_n))
        h, w, _ = self.im.shape
        assert w % 256 == 0 and h % 256 == 0
        assert math.floor(tx(lon_e)) - self.x0 + 1 == w // 256, (path, 'lon tiles')
        assert math.floor(ty(lat_s)) - self.y0 + 1 == h // 256, (path, 'lat tiles')
    def px(self, lon, lat):
        return ((self.tx(lon) - self.x0) * 256, (self.ty(lat) - self.y0) * 256)
    def covers(self, lon, lat, m=2):
        x, y = self.px(lon, lat); h, w, _ = self.im.shape
        return m <= x < w - m and m <= y < h - m
