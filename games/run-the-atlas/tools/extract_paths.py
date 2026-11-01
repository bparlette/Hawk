#!/usr/bin/env python3
"""
Run the Atlas — offline ground-path extraction. (ROUND 3)

Downloads each level map and extracts a runnable ground path in TWO passes:

  Pass A — scale the full sheet to H=720, scan surfaces (sky/void rejection +
  support rule, as round 1). From the surface distribution derive the
  DOMINANT BAND (mode-anchored contiguous histogram region), then apply the
  BAND-CONTINUITY GUARD: a grounded run that leaves the band by >25% of
  sheet height is a detour candidate. It is bridged into a pit only if it
  is (a) interior (grounded span on both sides), (b) width <= MAX_BRIDGE,
  and (c) MARGIN-SEPARATED — the vertical span between the band and the
  run's surfaces is dominated by the sheet's MARGIN color (the dead space
  of the page): the run hangs in the page's margin zone, printed
  elsewhere on the sheet (SMB's underground bonus room). A valley in the
  level's own continuous airspace (Sonic's dips — the span above their
  floors is sky, not margin) is the route, however deep it dips. If the
  sheet's margin color is indistinguishable from its sky (void
  detection inactive), separation is unprovable and nothing is bridged
  on this test.
  Runs touching either end of the grounded span are the stage's own
  opening/terminus geography and are KEPT (Cut Man spawns on its bottom
  floor; DuckTales ends on the moon surface); over-wide interior runs are
  kept and reported. The guard runs in pass A only: it targets sheet-level
  artifacts, and pass B works on the cropped stage, whose out-of-band
  structure is the stage's own geography (Castlevania's castle floor sits
  below its graveyard-dominated density band — a pass-B guard ate it).

  Crop — ROUND 3: PATH-WEIGHTED. The crop's top derives from the highest
  surface the guarded route actually touches (min route y) and its bottom
  from the lowest route point (max route y), each expanded by a margin of
  CROP_MARGIN_FRAC (13.5%) of the route band height (max-min). Round 2's
  crop used the route range + fixed margins (150 above, 45 below), which
  still followed the SHEET's content bounds too loosely: Green Hill's rip
  carries a tall empty sky above its highest route, so its frame stayed
  ~55% dead deep-blue sky. Path-weighting removes exactly the sky above
  the highest route point and the void below the lowest — the route band
  itself sets the frame. Stored per world in worlds.json as a
  source-pixel rect.
  Per-world exception (evidence over uniformity): CROP_KEEP_ROUND2 pins a
  world to the round-2 margins when the path-weighted crop is measurably
  worse there. World 1: the new top amputates SMB's flagpole (it rises
  above the highest route surface and is the level's endpoint landmark).
  World 2: the new top amputates the walked mesa plateau itself — see
  CROP_KEEP_ROUND2 for the scan-floor evidence. Both kept verbatim;
  worlds 3, 4, 5 take the path-weighted crop (probe strips and overlay
  zooms in the round-3 report section).
  Round 1 rendered whole sheets: SMB's level strip sat in the top ~55%
  over black void + sheet furniture (credit block, the printed
  underground bonus room). The crop removes exactly that.

  Pass B — crop the SOURCE sheet to the rect, scale the crop to H=720,
  re-scan with pass A's sky/void inherited (the crop's own bottom strip is
  floor, not void, so re-estimating there would be wrong) and finalize
  pits/spawn/relic. The game draws only the crop rect, scaled to fill the
  field; `mag` (= sheet height / crop height) records the magnification
  so game.js can scale its physics constants and keep round 1's
  jump/feature ratios.

Emits worlds.json + paths/<n>.json + proof overlays in overlays/.

Run:  python3 tools/extract_paths.py
"""
import io, json, math, os, statistics, sys, urllib.request
from collections import Counter
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAPS_DIR = os.path.join(HERE, "maps")
OVERLAY_DIR = os.path.join(ROOT, "overlays")
H = 720
MARGIN_TOP = 150        # round-2 legacy margins (720-space): kept only for
MARGIN_BOTTOM = 45      # worlds pinned in CROP_KEEP_ROUND2
CROP_MARGIN_FRAC = 0.135  # round 3: crop margin = this fraction of the route
                          # band height, above the route min and below the max
CROP_KEEP_ROUND2 = {
    1: "path-weighted top (route min - 18 px) amputates the flagpole, which "
       "rises above the highest route surface (end-staircase top); round-2 "
       "framing of 1-1 was already accepted as good — kept verbatim",
    2: "path-weighted top AMPUTATES THE HIGH ROUTE: Green Hill's walked "
       "mesa plateau (grass at source y~148) sits ABOVE the extractor's "
       "scan floor (pass-A surfaces record at y>=180 = source 320), so the "
       "recorded route min (180) is a scan artifact, not the route. The "
       "new top (source 246) puts the plateau grass 102 px above the "
       "frame and the ground line rides the scan floor through the cliff "
       "interior (overlay evidence, round-3 report). No vertical crop can "
       "place that surface in the pass-B scan band while containing the "
       "route bottom — a scan-floor fix is a v2 extractor change, out of "
       "round-3 scope. Round-2 crop kept: it at least contains the "
       "plateau, and its added sky above the true route top was already "
       "small (crop top 53 vs plateau ~148).",
}
MAX_BRIDGE = 220        # widest interior excursion the guard will bridge into a pit
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

def build_worlds():
    return [
        dict(n=1, game="Super Mario Bros.", area="World 1-1", platform="NES",
             url="https://nesmaps.com/maps/SuperMarioBrothers/SuperMarioBrosMap1-1BG.png",
             dims=[3584, 480], pool="pool-d (nesmaps)"),
        dict(n=2, game="Sonic the Hedgehog", area="Green Hill Zone Act 1",
             platform="Genesis",
             url="https://vgmaps.com/Atlas/Genesis/SonicTheHedgehog-GreenHillZone-Act1.png",
             dims=[10096, 1280], pool="pool-b (vgmaps) — the REAL Genesis Act 1, found by the "
             "post-spike gap hunt (verified live, 10,096x1,280, full strip). Replaces the "
             "round-1/2 Master System Act 3 substitute (the Genesis map was absent from "
             "pools a/b/d as catalogued). Its rip bakes a title/credit panel into the left "
             "margin — the extractor trims it horizontally (see left_trim)."),
        dict(n=3, game="Mega Man", area="Cut Man", platform="NES",
             url="https://vgmaps.com/Atlas/NES/MegaMan-CutMan.png",
             dims=[3360, 2192], pool="pool-a (vgmaps)"),
        dict(n=4, game="Castlevania", area="Stage 1", platform="NES",
             url="https://nesmaps.com/maps/Castlevania/CastlevaniaMapLevel01a.png",
             dims=[3584, 432], pool="pool-d (nesmaps)"),
        dict(n=5, game="DuckTales", area="The Moon", platform="NES",
             url="https://vgmaps.com/Atlas/NES/DuckTales-Moon.png",
             dims=[2048, 1384], pool="pool-a (vgmaps)"),
    ]

def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)

def strip_color(px, w, y0, y1):
    """Dominant color over rows [y0, y1), sampled every 3 px."""
    bins = Counter()
    samples = {}
    for y in range(y0, y1):
        for x in range(0, w, 3):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            key = (r // 16, g // 16, b // 16)
            bins[key] += 1
            samples.setdefault(key, []).append((r, g, b))
    if not bins:
        return (0, 0, 0)
    top = bins.most_common(1)[0][0]
    pts = samples[top]
    return tuple(sum(c[i] for c in pts) // len(pts) for i in range(3))

def scan(img, sky=None, void=None, void_active=None):
    """Column surface scan on an RGBA image already scaled to height H.
    Returns (ground, sky, void, void_active, margin_frac): ground is the
    median-filtered, smoothed per-column surface list (None = no surface);
    margin_frac(x, y0, y1) is the fraction of sampled pixels in that
    column span matching the sheet's margin (void) color — the guard's
    margin-separation test uses it. Sky/void are estimated from the sheet
    unless inherited values are passed in."""
    w, h = img.size
    px = img.load()
    if sky is None:
        sky = strip_color(px, w, 0, max(4, int(H * 0.05)))
    sr, sg, sb = sky
    if void is None:
        # Void color: dominant color of the BOTTOM strip (the empty margin
        # under / around the level art on many map sheets). When it differs
        # strongly from the sky, pixels of that color are see-through void,
        # not floor — otherwise pit columns over a black under-margin fake a
        # floor at the margin's top edge (SMB 1-1's two pits did exactly
        # this before the rule existed).
        void = strip_color(px, w, H - max(4, int(H * 0.04)), H)
    vr, vg, vb = void
    if void_active is None:
        void_active = (vr - sr) ** 2 + (vg - sg) ** 2 + (vb - sb) ** 2 > 55 * 55
    VOID2 = 30 * 30
    y_start = int(H * 0.25)  # scan the lower 75%
    DIST2 = 55 * 55
    def solid(x, y):
        if y >= H:
            return False
        r, g, b, a = px[x, y]
        if a < 128:
            return False
        if (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2 <= DIST2:
            return False
        if void_active and (r - vr) ** 2 + (g - vg) ** 2 + (b - vb) ** 2 <= VOID2:
            return False
        return True

    ground = [None] * w
    for x in range(w):
        run = 0
        for y in range(y_start, H):
            if solid(x, y):
                run += 1
                if run >= 6:
                    cand = y - 5
                    # Support rule: a real floor has body beneath it. A thin
                    # sheet band (map credit strip / seam line) does not.
                    below = range(cand + 1, min(H, cand + 49))
                    sup = sum(1 for yy in below if solid(x, yy)) / max(1, len(list(below)))
                    if sup >= 0.45:
                        ground[x] = cand
                        break
                    run = 0  # floating band: keep scanning below it
                continue
            run = 0
    # median filter, window 15 (majority-non-None rule keeps real pits)
    med = [None] * w
    for x in range(w):
        vals = [ground[i] for i in range(max(0, x - 7), min(w, x + 8)) if ground[i] is not None]
        if len(vals) >= 8:
            med[x] = statistics.median(vals)
    # moving-average smoothing within grounded runs only
    sm = list(med)
    for _ in range(2):
        out = list(sm)
        x = 0
        while x < w:
            if sm[x] is None:
                x += 1
                continue
            x0 = x
            while x < w and sm[x] is not None:
                x += 1
            run_vals = sm[x0:x]
            n = len(run_vals)
            for i in range(n):
                lo = max(0, i - 4); hi = min(n, i + 5)
                out[x0 + i] = sum(run_vals[lo:hi]) / (hi - lo)
        sm = out
    ground = [None if v is None else int(round(v)) for v in sm]

    def margin_frac(x, y0, y1):
        ys = list(range(max(0, y0), min(H, y1), 4))
        if not ys:
            return 0.0
        hit = 0
        for y in ys:
            r, g, b, a = px[x, y]
            if a >= 128 and (r - vr) ** 2 + (g - vg) ** 2 + (b - vb) ** 2 <= VOID2:
                hit += 1
        return hit / len(ys)

    return ground, list(sky), list(void), bool(void_active), margin_frac

def density_band(ground, binw=15):
    """The dominant band: from the mode bin of the surface-y histogram,
    expand while neighbouring bins hold >= max(6, 1% of grounded) columns.
    Returns (band_top, band_bottom) in 720-space y."""
    vals = [v for v in ground if v is not None]
    if not vals:
        return 0, H - 1
    hist = Counter(v // binw for v in vals)
    mode = max(hist, key=hist.get)
    floor = max(6, int(0.01 * len(vals)))
    lo = mode
    while hist.get(lo - 1, 0) >= floor:
        lo -= 1
    hi = mode
    while hist.get(hi + 1, 0) >= floor:
        hi += 1
    return lo * binw, (hi + 1) * binw - 1

def left_trim(ground_width, margin_frac, void_active):
    """Horizontal analogue of the band crop: some rips bake a title/credit
    panel into the LEFT margin (the Genesis Green Hill rip: title art +
    'compiled by' box over black, ~350 source px). Panel columns are
    dominated by the sheet's margin color over the FULL column height;
    level columns are not (their margin share is only the dead space
    below/above the terrain). Returns the pass-A x of the first sustained
    non-panel column, or 0 when there is no panel (or margin color is
    indistinguishable from sky, so panel-ness is unprovable)."""
    if not void_active or margin_frac is None:
        return 0
    # Find the first sustained non-panel stretch (30 columns). The panel
    # is real only if >= 40 panel columns precede it — SMB's left edge is
    # a 16-column black sliver before clean columns, and trimming a
    # border sliver would just be noise.
    limit = int(ground_width * 0.15)
    panel_cols = 0
    x = 0
    while x < limit:
        if margin_frac(x, 0, H) >= 0.5:
            panel_cols += 1
            x += 1
            continue
        if all(margin_frac(xx, 0, H) < 0.5 for xx in range(x, min(ground_width, x + 30))):
            return x if panel_cols >= 40 else 0
        x += 1
    return 0

def margin_separated(g, x0, x1, band_edge, margin_frac):
    """Does the sheet's MARGIN fill the vertical span between the band
    edge and this run's surfaces? Samples up to 5 columns across the run.
    A printed sub-area (SMB's bonus room) sits in the page's dead margin
    (mean margin fraction > 0.5); a valley in the level's own airspace
    has sky, not margin, above its floor."""
    if margin_frac is None:
        return False
    xs = sorted(set([x0 + 2, (x0 + x1) // 2, x1 - 2,
                     x0 + (x1 - x0) // 4, x1 - (x1 - x0) // 4]))
    fracs = []
    for x in xs:
        surf = g[x]
        if surf is None:
            continue
        lo, hi = (band_edge + 8, surf - 8) if surf > band_edge else (surf + 8, band_edge - 8)
        if hi - lo < 12:
            continue
        fracs.append(margin_frac(x, lo, hi))
    return bool(fracs) and (sum(fracs) / len(fracs)) > 0.5

def apply_guard(ground, band_top, band_bottom, margin_frac=None, void_active=False):
    """Band-continuity guard (pass A). A grounded run whose surface leaves
    the band by >25% of sheet height (H/4 = 180) is a detour CANDIDATE:
      - interior + width <= MAX_BRIDGE + margin-separated -> BRIDGED: the
        columns become a pit, exactly like a natural gap;
      - interior + width <= MAX_BRIDGE but no margin separation -> KEPT
        (a valley in the level's own airspace is the route);
      - run touching either end of the grounded span -> KEPT (the stage's
        own opening/terminus geography, e.g. Cut Man's spawn floor,
        DuckTales' moon surface);
      - interior run wider than MAX_BRIDGE -> KEPT and reported (bridging
        it would dig an unjumpable pit and soft-lock the world).
    Returns (ground, triggers)."""
    g = list(ground)
    thr_hi = band_bottom + H // 4
    thr_lo = band_top - H // 4
    gi = [i for i, v in enumerate(g) if v is not None]
    triggers = []
    if not gi:
        return g, triggers
    first, last = gi[0], gi[-1]
    def out_of_band(v):
        return v is not None and (v > thr_hi or v < thr_lo)
    x = first
    while x <= last:
        if out_of_band(g[x]):
            x0 = x
            while x <= last and out_of_band(g[x]):
                x += 1
            x1 = x - 1
            width = x1 - x0 + 1
            below = g[x0] > thr_hi
            rec = dict(span=[x0, x1], width=width,
                       ymax=max(g[x0:x1 + 1]), thr_hi=thr_hi)
            if x0 > first and x1 < last and width <= MAX_BRIDGE:
                edge = band_bottom if below else band_top
                if void_active and margin_separated(g, x0, x1, edge, margin_frac):
                    for i in range(x0, x1 + 1):
                        g[i] = None
                    rec["action"] = "bridged-to-pit"
                else:
                    rec["action"] = "kept-open-terrain"
            elif x0 <= first or x1 >= last:
                rec["action"] = "kept-edge-run"
            else:
                rec["action"] = "kept-wide-run"
            triggers.append(rec)
        else:
            x += 1
    return g, triggers

def finalize(ground):
    """Pits / spawn / relic / stats from a (guarded) ground array."""
    w = len(ground)
    grounded_idx = [i for i, v in enumerate(ground) if v is not None]
    pits = []
    if grounded_idx:
        first, last = grounded_idx[0], grounded_idx[-1]
        x = first
        while x <= last:
            if ground[x] is None:
                x0 = x
                while x <= last and ground[x] is None:
                    x += 1
                pits.append([x0, x - 1])
            else:
                x += 1
        spawn_x = first + 6
        total = len(grounded_idx)
        target = int(total * 0.60)
        relic_x = grounded_idx[min(target, total - 1)]
        # Relic placement refinement: the raw 60% point can land in a
        # fall-shadow pocket — a dip the runner's fall arc overshoots
        # (world 1 pass B: the 60% point sat in a 76 px pocket between a
        # high brick row and the ground; the runner fell from the row,
        # sailed over the pocket, and never touched the relic). Prefer
        # the near-level grounded stretch closest to the 60% mark: a
        # +-60 px window, fully grounded, surface range <= 12 px.
        import bisect
        flat = []
        for fx in range(60, w - 60):
            win = ground[fx - 60:fx + 61]
            if any(v is None for v in win):
                continue
            if max(win) - min(win) <= 12:
                flat.append(fx)
        if flat:
            relic_x = min(flat, key=lambda fx: abs(bisect.bisect_left(grounded_idx, fx) - target))
    else:
        spawn_x, relic_x = 20, w // 2
    return dict(
        pits=pits,
        spawn=dict(x=spawn_x, y=ground[spawn_x] if ground[spawn_x] is not None else H - 40),
        relic=dict(x=relic_x, y=ground[relic_x] if ground[relic_x] is not None else H - 40),
        grounded_pct=round(100.0 * len(grounded_idx) / w, 1) if w else 0.0,
    )

def simplify(ground, step=8, eps=2.5):
    pts = []
    w = len(ground)
    xs = [x for x in range(0, w, step) if ground[x] is not None]
    if w - 1 not in xs and ground[w - 1] is not None:
        xs.append(w - 1)
    pts = [(x, ground[x]) for x in xs]
    if len(pts) < 3:
        return pts
    def dp(seg):
        if len(seg) <= 2:
            return seg
        (x1, y1), (x2, y2) = seg[0], seg[-1]
        dx, dy = x2 - x1, y2 - y1
        denom = math.hypot(dx, dy) or 1.0
        worst, wi = -1, -1
        for i in range(1, len(seg) - 1):
            px_, py_ = seg[i]
            d = abs(dy * px_ - dx * py_ + x2 * y1 - y2 * x1) / denom
            if d > worst:
                worst, wi = d, i
        if worst > eps:
            return dp(seg[:wi + 1])[:-1] + dp(seg[wi:])
        return [seg[0], seg[-1]]
    # split by pits so the polyline never bridges a gap
    out, seg = [], []
    last_x = None
    for x, y in pts:
        if last_x is not None and x - last_x > step:
            if len(seg) >= 2:
                out += dp(seg)
            elif seg:
                out += seg
            seg = []
        seg.append((x, y))
        last_x = x
    if len(seg) >= 2:
        out += dp(seg)
    elif seg:
        out += seg
    return out

def overlay(img, ground, fin, label, path):
    base = img.convert("RGB")
    w, h = base.size
    scale = min(1.0, 1700 / w)
    ow, oh = int(w * scale), int(h * scale)
    ov = base.resize((ow, oh), Image.LANCZOS)
    dr = ImageDraw.Draw(ov)
    g = ground
    last = None
    for x in range(0, w, 3):
        if g[x] is None:
            last = None
            continue
        p = (x * scale, g[x] * scale)
        if last is not None:
            dr.line([last, p], fill=(57, 255, 20), width=3)
        last = p
    for x0, x1 in fin["pits"]:
        dr.rectangle([x0 * scale, oh - 14, x1 * scale, oh - 2], fill=(255, 40, 40))
        dr.line([(x0 * scale, oh - 40), (x0 * scale, oh - 2)], fill=(255, 40, 40), width=2)
    rx, ry = fin["relic"]["x"] * scale, (fin["relic"]["y"] - 26) * scale
    dr.ellipse([rx - 8, ry - 8, rx + 8, ry + 8], fill=(255, 200, 0), outline=(255, 255, 255), width=2)
    sx, sy = fin["spawn"]["x"] * scale, fin["spawn"]["y"] * scale
    dr.ellipse([sx - 7, sy - 7, sx + 7, sy + 7], fill=(0, 220, 255), outline=(255, 255, 255), width=2)
    dr.rectangle([0, 0, min(ow, 12 + 8 * len(label)), 22], fill=(0, 0, 0))
    dr.text((6, 5), label, fill=(255, 255, 0))
    ov.save(path)

def main():
    worlds = build_worlds()
    out_worlds = []
    os.makedirs(MAPS_DIR, exist_ok=True)
    os.makedirs(OVERLAY_DIR, exist_ok=True)
    for wd in worlds:
        fname = f"{wd['n']}_{os.path.basename(wd['url'].split('?')[0])}"
        fpath = os.path.join(MAPS_DIR, fname)
        download(wd["url"], fpath)
        img = Image.open(fpath).convert("RGBA")
        src_w, src_h = img.size
        real_dims = [src_w, src_h]

        # ---- Pass A: whole sheet at H=720 -------------------------------
        nw_a = round(src_w * H / src_h)
        scaled_a = img.resize((nw_a, H), Image.LANCZOS)
        ground_a, sky, void, void_active, margin_frac_a = scan(scaled_a)
        # Horizontal trim: a title/credit panel baked into the left margin
        # is masked out of every pass-A statistic (band, guard, crop range)
        # and out of the crop rect, so the run starts on the level itself.
        trim_a = left_trim(nw_a, margin_frac_a, void_active)
        if trim_a:
            ground_a = [None] * trim_a + ground_a[trim_a:]
        band_a = density_band(ground_a)
        ground_a, trig_a = apply_guard(ground_a, *band_a,
                                       margin_frac=margin_frac_a, void_active=void_active)
        # Crop range = guarded route range, but the steep smoothed lips
        # flanking a bridged pit are part of the excursion, not the route
        # band: exclude out-of-band columns within 30 px of a bridged span.
        bridged = [t["span"] for t in trig_a if t["action"] == "bridged-to-pit"]
        def near_bridged(x):
            return any(s - 30 <= x <= e + 30 for s, e in bridged)
        route_vals = [v for x, v in enumerate(ground_a)
                      if v is not None and not (near_bridged(x) and not (band_a[0] <= v <= band_a[1]))]
        if not route_vals:
            route_vals = [v for v in ground_a if v is not None]
        if not route_vals:
            raise RuntimeError(f"world {wd['n']}: pass A found no route")

        # ---- Crop rect: PATH-WEIGHTED (round 3) --------------------------
        # Top = highest surface the route touches, bottom = lowest route
        # point, each expanded by CROP_MARGIN_FRAC of the route band
        # height. Worlds pinned in CROP_KEEP_ROUND2 use the legacy fixed
        # margins instead (reason logged there and in worlds.json).
        route_min, route_max = min(route_vals), max(route_vals)
        band_h = route_max - route_min
        if wd["n"] in CROP_KEEP_ROUND2:
            crop_rule = "round2-content-band (kept)"
            crop_note = CROP_KEEP_ROUND2[wd["n"]]
            margin_used = None
            cy0 = max(0, route_min - MARGIN_TOP)         # 720-space
            cy1 = min(H, route_max + MARGIN_BOTTOM)      # 720-space
        else:
            crop_rule = "path-weighted"
            crop_note = ""
            margin_used = round(CROP_MARGIN_FRAC * band_h, 1)
            cy0 = max(0, route_min - margin_used)        # 720-space
            cy1 = min(H, route_max + margin_used)        # 720-space
        crop = dict(
            x=int(round(trim_a * src_h / H)),
            y=int(round(cy0 * src_h / H)),
            w=src_w - int(round(trim_a * src_h / H)),
            h=int(round((cy1 - cy0) * src_h / H)),
        )
        mag = round(src_h / crop["h"], 3)

        # ---- Pass B: crop -> H=720, inherited sky/void, NO guard --------
        # The guard is a sheet-level instrument (pass A). Inside the crop,
        # out-of-band structure is the stage's own geography.
        cropped = img.crop((crop["x"], crop["y"], crop["x"] + crop["w"], crop["y"] + crop["h"]))
        nw_b = round(crop["w"] * H / crop["h"])
        scaled_b = cropped.resize((nw_b, H), Image.LANCZOS)
        ground_b, _, _, _, _ = scan(scaled_b, sky=tuple(sky), void=tuple(void), void_active=void_active)
        band_b = density_band(ground_b)  # recorded for the report trail only
        trig_b = []
        fin = finalize(ground_b)
        poly = simplify(ground_b)

        label = f"{wd['n']}. {wd['game']} - {wd['area']}"
        overlay(scaled_b, ground_b, fin,
                f"{label}  [crop y={crop['y']} h={crop['h']} mag={mag}]",
                os.path.join(OVERLAY_DIR, f"{wd['n']}.png"))
        entry = dict(
            n=wd["n"], game=wd["game"], area=wd["area"], platform=wd["platform"],
            label=f"{wd['game']} — {wd['area']}",
            image_url=wd["url"], pool_dims=wd["dims"], real_dims=real_dims, pool=wd["pool"],
            width=nw_b, height=H, sky=sky,
            void=void, void_active=void_active,
            grounded_pct=fin["grounded_pct"], pit_count=len(fin["pits"]),
            crop=crop, mag=mag, left_trim_src_px=crop["x"],
            crop_rule=crop_rule, crop_note=crop_note,
            route_band=dict(min=route_min, max=route_max, band_h=band_h,
                            margin_frac=CROP_MARGIN_FRAC, margin_px=margin_used),
            band=dict(passA=list(band_a), passB=list(band_b)),
            guard=dict(passA=trig_a, passB="not applied — sheet-level guard runs in pass A only"),
            path_file=f"paths/{wd['n']}.json",
        )
        pdata = dict(width=nw_b, height=H, ground=ground_b, pits=fin["pits"],
                     spawn=fin["spawn"], relic=fin["relic"],
                     crop=crop, mag=mag,
                     polyline=[[int(x), int(y)] for x, y in poly])
        os.makedirs(os.path.join(ROOT, "paths"), exist_ok=True)
        with open(os.path.join(ROOT, "paths", f"{wd['n']}.json"), "w") as pf:
            json.dump(pdata, pf)
        out_worlds.append(entry)
        print(f"[{wd['n']}] {label}: dims={real_dims} crop={crop} mag={mag} rule={crop_rule} "
              f"route={route_min}..{route_max} band_h={band_h} margin={margin_used} trimA={trim_a} "
              f"W={nw_b} grounded={fin['grounded_pct']}% pits={len(fin['pits'])} {fin['pits']} "
              f"bandA={band_a} bandB={band_b}")
        for t in trig_a:
            print(f"      guardA: {t}")
        for t in trig_b:
            print(f"      guardB: {t}")
    with open(os.path.join(ROOT, "worlds.json"), "w") as f:
        json.dump(dict(height=H, worlds=out_worlds), f)
    print("wrote worlds.json + overlays/")

if __name__ == "__main__":
    main()
