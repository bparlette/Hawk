#!/usr/bin/env python3
# mk.py <spec.json> : frames segments -> 1080x1920 30fps short with captions, flashes, synth audio
import json, sys, os, subprocess, wave, struct, math, random
spec = json.load(open(sys.argv[1]))
W, H, FPS = 1080, 1920, 30
out = spec["out"]; tmp = out + ".tmp"; os.makedirs(tmp, exist_ok=True)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
segs = spec["segs"]  # each: dir, a, b (frame range), speed(opt), cap
lst = []; t = 0.0; cuts = []
for i, s in enumerate(segs):
    files = sorted(f for f in os.listdir(s["dir"]) if f.endswith((".jpg", ".png")))[s["a"]:s["b"]]
    sp = s.get("speed", 1.0); srcfps = s.get("fps", 30)
    ext = files[0].rsplit(".", 1)[1]
    d = os.path.join(tmp, "s%d" % i); os.makedirs(d, exist_ok=True)
    for k, f in enumerate(files):
        dst = os.path.join(d, "%05d.%s" % (k, ext))
        if not os.path.exists(dst): os.symlink(os.path.abspath(os.path.join(s["dir"], f)), dst)
    dur = len(files) / (srcfps * sp)
    cap = s.get("cap", "").replace("'", "\u2019").replace(":", "\\:")
    vf = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d," % (W, H, W, H))
    if s.get("zoom"):
        vf = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,zoompan=z='1+0.0015*on':d=1:s=%dx%d:fps=%d," % (W*2, H*2, W*2, H*2, W, H, FPS))
    vf += "fps=%d,setpts=PTS/%f," % (FPS, 1.0) if False else ""
    vf += "fade=t=in:st=0:d=0.12:color=white,"
    if cap:
        vf += ("drawtext=fontfile=%s:text='%s':fontsize=%d:fontcolor=white:borderw=10:bordercolor=black:"
               "x=(w-text_w)/2:y=h*0.27" % (FONT, cap, min(110, int(1000/(0.64*max(1,len(cap)))))))
    vf = vf.rstrip(",")
    o = os.path.join(tmp, "s%d.mp4" % i)
    rate = srcfps * sp
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(rate), "-i", os.path.join(d, "%05d." + ext),
                    "-vf", vf + ",fps=%d,format=yuv420p" % FPS, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-r", str(FPS), o], check=True)
    lst.append(o); cuts.append(t); t += dur
open(tmp + "/l.txt", "w").write("".join("file '%s'\n" % p for p in lst))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", tmp + "/l.txt", "-c", "copy", tmp + "/v.mp4"], check=True)
# synth audio: driving beat + bass + hits on cuts
SR = 44100; N = int(SR * (t + 0.5)); bpm = spec.get("bpm", 150); beat = 60 / bpm
buf = [0.0] * N; rnd = random.Random(7)
root = spec.get("root", 55.0); prog = [1, 1, 1.189, 0.891]
def add(i, v):
    if 0 <= i < N: buf[i] += v
nb = int(t / beat) + 2
for b in range(nb):
    s0 = int(b * beat * SR)
    for k in range(int(0.18 * SR)):  # kick
        e = math.exp(-k / (0.04 * SR)); add(s0 + k, 0.55 * e * math.sin(2 * math.pi * (50 + 120 * e) * k / SR))
    if b % 2 == 1:
        for k in range(int(0.12 * SR)):  # snare
            add(s0 + k, 0.25 * math.exp(-k / (0.03 * SR)) * (rnd.random() * 2 - 1))
    for h in (0, 0.5):
        hs = int((b + h) * beat * SR)
        for k in range(int(0.03 * SR)): add(hs + k, 0.07 * math.exp(-k / (0.006 * SR)) * (rnd.random() * 2 - 1))
    f = root * prog[(b // 4) % 4]
    for k in range(int(beat * SR)):  # saw bass
        ph = (f * k / SR) % 1.0; add(s0 + k, 0.16 * (2 * ph - 1) * min(1, k / 200) * math.exp(-k / (0.3 * SR)))
    if b % 2 == 0:  # lead arp
        for j, m in enumerate((2, 3, 4)):
            ss = s0 + int(j * beat / 3 * SR); ff = f * m * 2
            for k in range(int(beat / 3 * SR)): add(ss + k, 0.06 * math.copysign(1, math.sin(2 * math.pi * ff * k / SR)) * math.exp(-k / (0.08 * SR)))
for c in cuts[1:]:  # whoosh/impact
    s0 = int(c * SR)
    for k in range(int(0.35 * SR)):
        e = math.exp(-k / (0.09 * SR)); add(s0 + k, 0.5 * e * ((rnd.random() * 2 - 1) * 0.6 + 0.6 * math.sin(2 * math.pi * (40 + 60 * e) * k / SR)))
pk = max(abs(x) for x in buf) or 1
with wave.open(tmp + "/a.wav", "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(32000 * math.tanh(1.3 * x / pk))) for x in buf))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp + "/v.mp4", "-i", tmp + "/a.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", out], check=True)
print(out, round(t, 1))
