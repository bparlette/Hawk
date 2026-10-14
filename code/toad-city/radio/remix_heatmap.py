#!/usr/bin/env python3
"""Build-time: YouTube "Most Replayed" heatmap -> best 20 s window per remix track.
Usage: python3 radio/remix_heatmap.py > radio/remix_peaks.json
Fetches each watch page once, parses ytInitialData (macroMarkersListEntity MARKER_TYPE_HEATMAP,
or legacy heatMarkersDecorations/heatMarkerRenderer), slides a 20 s window in 0.5 s steps and picks
the max summed intensity. No heatmap -> fallback (35% in, at least 30 s past the intro) flagged 'fallback'.
The game never scrapes at runtime; paste the result into REMIX_PEAK in src/08_radio.js."""
import json, re, sys, time, urllib.request
IDS = "quUSjngSmN0 qEnptXwZSfo 1zRb_WNEeaw rvZWAEDI6bY 1kbwFhD597Q gXVaIiexbRk u2hse3dRJZ8 gVCCuHMRpco l_xzOk0w3qU BbXklS6t4AM RT0GKX-Pfkg 9WyLkGp9eM0 fHAigWTZioI BWpbV-DrI_0 GI7wtAZaXXs mze0GuD2k6c Av5jyGX2yE8 SrYcZfalGjI kUlr1WLU6ys f32eCeneIbY 7Z3ExxAPSF8 _Dru5adhPjU KKIunI_nlKg jovjP6StSWU Svmcd4uvkiY 8pWftkom4_I RknlZpl-VpM V16BdeeA4YY uwl1zto209M XIs3B_CL0l8".split()
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
CLIP = 20000
def fetch(i):
    rq = urllib.request.Request(f"https://www.youtube.com/watch?v={i}&hl=en", headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI"})
    with urllib.request.urlopen(rq, timeout=20) as r: return r.geturl(), r.read().decode("utf-8", "replace")
def markers(obj):
    out = []
    def walk(o):
        if isinstance(o, dict):
            if "startMillis" in o and ("intensityScoreNormalized" in o or "heatMarkerIntensityScoreNormalized" in o):
                out.append((float(o["startMillis"]), float(o.get("durationMillis") or o.get("markerDurationMillis") or 0), float(o.get("intensityScoreNormalized", o.get("heatMarkerIntensityScoreNormalized")))))
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(obj); return sorted(set(out))
def best(pts, len_ms):
    bs, bv = 0, -1
    for s in range(0, max(1, int(len_ms - CLIP) + 1), 500):
        v = sum(val * max(0, min(a + d, s + CLIP) - max(a, s)) / d for a, d, val in pts if d > 0)
        if v > bv: bv, bs = v, s
    return bs / 1000
res = {}
for i in IDS:
    rec = {"id": i}
    try:
        url, h = fetch(i)
        if "google.com/sorry" in url: raise RuntimeError("rate-limited (google.com/sorry)")
        ln = re.search(r'"lengthSeconds":"(\d+)"', h); rec["len"] = int(ln.group(1)) if ln else None
        m = re.search(r"var ytInitialData\s*=\s*(\{.*?\});</script>", h, re.S)
        pts = markers(json.loads(m.group(1))) if m else []
        if pts and rec["len"]: rec.update(src="heatmap", start=best(pts, rec["len"] * 1000), n=len(pts))
    except Exception as e: rec["err"] = str(e)[:120]
    if "src" not in rec:
        L = rec.get("len"); rec.update(src="fallback", start=round(max(30, 0.35 * L), 1) if L else 45)
    res[i] = rec; print(i, rec, file=sys.stderr); time.sleep(1.5)
json.dump(res, sys.stdout, indent=1)
