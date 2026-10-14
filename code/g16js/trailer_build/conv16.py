# 16-bit look, same as g16js/convert.py full scenes: Lanczos down to game pixels (384 px across the game canvas),
# octree 31 colours, snap to 9-bit (3 bits/ch), nearest back up to the original size.
import sys, subprocess, json, numpy as np
from PIL import Image
GW = 384
def g9(a): return (np.round(np.asarray(a, dtype=np.float32) / 255 * 7) * 255 / 7).astype(np.uint8)
def conv(im, canvas_w=None, nc=31):
    im = im.convert("RGB"); W, H = im.size
    k = GW / float(canvas_w or W)
    w, h = max(1, round(W * k)), max(1, round(H * k))
    s = im.resize((w, h), Image.LANCZOS)
    q = s.quantize(nc, method=Image.FASTOCTREE, kmeans=4, dither=Image.NONE).convert("RGB")
    return Image.fromarray(g9(np.array(q))).resize((W, H), Image.NEAREST)
def probe(p):
    o = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", p]))
    v = [s for s in o["streams"] if s["codec_type"] == "video"][0]
    br = int(v.get("bit_rate") or o["format"]["bit_rate"])
    return int(v["width"]), int(v["height"]), v["r_frame_rate"], br
def video(src, dst, codec="h264", canvas_w=None, audio_from=None):
    W, H, fps, br = probe(src)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    asrc = audio_from or src
    common = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", fps, "-i", "-", "-i", asrc, "-map", "0:v", "-map", "1:a", "-c:a", "copy"]
    kb = br // 1000
    if codec == "h264":
        enc = common + ["-c:v", "libx264", "-preset", "medium", "-b:v", f"{kb}k", "-maxrate", f"{int(kb*1.5)}k", "-bufsize", f"{kb*3}k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst]
    else:
        enc = common + ["-c:v", "libvpx-vp9", "-b:v", f"{kb}k", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-pix_fmt", "yuv420p", dst]
    e = subprocess.Popen(enc, stdin=subprocess.PIPE)
    n = 0; fs = W * H * 3
    while True:
        b = dec.stdout.read(fs)
        if len(b) < fs: break
        e.stdin.write(conv(Image.frombytes("RGB", (W, H), b), canvas_w).tobytes()); n += 1
    e.stdin.close(); e.wait(); dec.wait()
    if e.returncode: raise SystemExit("encode failed " + dst)
    print("video", dst, n, "frames", flush=True)
if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "video":
        video(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "h264", int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "0" else None, sys.argv[6] if len(sys.argv) > 6 else None)
    elif mode == "image":  # src dst [canvas_w]
        im = Image.open(sys.argv[2]); cw = int(sys.argv[4]) if len(sys.argv) > 4 else None
        q = Image.open(sys.argv[2]).info
        conv(im, cw).save(sys.argv[3], quality=92, subsampling=0); print("img", sys.argv[3])
