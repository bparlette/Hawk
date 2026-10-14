"""Re-render the trailer_v2 edit (same raw captures, same timeline code = identical cut) as SHELL SHOCK 16-BIT.
- every raw game frame goes through conv16.conv (16-bit look) before the editor composites it
- slam-card text: SHELL SHOCK LIVE -> SHELL SHOCK 16-BIT, PLAY URL -> shellshock16bit.surge.sh
- screen/game modes: each finished frame is ALSO passed through conv16.conv (overlays/cards get the 16-bit look too)
- cabinet mode (full): cabinet art untouched, only the game frames inside it are 16-bit
- audio: copied from the original painted file (same timeline length); video re-encoded H.264 yuv420p at the original bitrate, +faststart
usage: python3 render16.py game|screen|full [levels...]
"""
import sys, os, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
TV2 = "/workspace/work/trailer_v2"
WHAT = sys.argv[1]; LV = sys.argv[2:]
os.environ.setdefault("LEVEL_SRC", TV2 + "/final_game/levels")
sys.argv = ["build2.py", TV2 + "/raw_final", TV2 + "/ref_final", HERE + "/r16", WHAT] + LV
sys.path.insert(0, TV2); sys.path.insert(0, HERE)
import build2 as B
from conv16 import conv, probe
from PIL import Image
ORIG = HERE + "/orig/v"
B.PLAY_URL = "shellshock16bit.surge.sh"
_sc = B.seg_card
def seg_card(lines, bg, seed=0):
    m = {"SHELL SHOCK LIVE": "SHELL SHOCK 16-BIT", "LIVE": "16-BIT"}
    return _sc([(m.get(s, s),) + tuple(r) for s, *r in lines], bg, seed)
B.seg_card = seg_card
_game = B.Cap.game
B.Cap.game = lambda self, i: conv(_game(self, i))
B.stills = lambda cap, mom, n: []
B.contact_boss = lambda *a, **k: ("", [])
def render(self, mp4, seed=0, key=0, crf="22", maxrate="2600k"):
    src = os.path.join(ORIG, os.path.basename(mp4))
    W, H, fps, br = probe(src); assert (W, H) == (B.W, B.H), (W, H, B.W, B.H)
    kb = br // 1000; post = B.SCREEN
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(B.FPS), "-i", "-", "-i", src,
           "-map", "0:v", "-map", "1:a", "-c:a", "copy", "-c:v", "libx264", "-preset", "medium", "-b:v", f"{kb}k", "-maxrate", f"{int(kb*1.5)}k",
           "-bufsize", f"{kb*3}k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest", mp4]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE); poster = None; im = None
    for st, n, fn in self.segs:
        for t in range(n):
            B.CUR_INP = None
            im = fn(t, n)
            if post: im = conv(im)
            if post and WHAT == "screen":  # letterbox bands above/below the game canvas stay pure black (as the game draws them), not a quantized dark grey
                sx, sy, sw, sh = B.SG; im = im.copy(); im.paste((0, 0, 0), (0, 0, W, sy)); im.paste((0, 0, 0), (0, sy + sh, W, H))
            ip = B.CUR_INP or {}
            self.inputs.append([int(ip.get("dx", 0)), int(ip.get("dy", 0)), 1 if ip.get("a") else 0, 1 if ip.get("b") else 0, 1 if ip.get("p") else 0])
            if self.poster_at is not None and st + t == self.poster_at: poster = im.copy()
            p.stdin.write(im.convert("RGB").tobytes())
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit("ffmpeg failed " + mp4)
    enc = "".join(chr(48 + (dx + 1) * 3 + (dy + 1) + 9 * (a + 2 * b + 4 * pp)) for dx, dy, a, b, pp in self.inputs)
    json.dump({"fps": B.FPS, "frames": len(self.inputs), "enc": "chr(48+v), v=(dx+1)*3+(dy+1)+9*(a+2b+4p)", "data": enc}, open(mp4.replace(".mp4", "_inputs.json"), "w"))
    (poster or im).convert("RGB").save(mp4.replace(".mp4", ".jpg"), quality=84)
    print("rendered", mp4, len(self.inputs), "frames", flush=True)
    return self.n / B.FPS
B.Timeline.render = render
B.main()
