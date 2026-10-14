#!/usr/bin/env python3
"""Toad City Shorts editor: edit.py <spec.json>
Spec: name, out, music (raw/music/<name>.wav), music_db, sfx_db, segs [{src,a,b,speed,zoom,cx,cy,flash,gamma}],
captions [{text,t0,t1,y,size,color,font}], hit {seg, t}  (a source time inside segment seg that must land on a downbeat),
extra_fx [{wav,t,db}] (output times), endcard_dur, hook_whoosh (bool).
Everything is 1080x1920, 30 fps. Audio: game SFX (captured offline from the game's WebAudio) + the game's own synth beat."""
import json, os, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

B = os.environ.get('SHORTS_BASE', '/workspace/work/toad-city/shorts/batch1')
FONTS = os.environ.get('FONT_DIR', '/workspace/work/trailer_v2/fonts')
FONT_CAP = FONTS + '/Anton.ttf'
FONT_PIX = FONTS + '/PressStart2P.ttf'
W, H, FPS = 1080, 1920, 30
BAR = 4 * 60 / 130  # the game's proc beat: 130 bpm


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print('CMD FAILED', ' '.join(cmd)[:600]); print(r.stderr[-3000:]); sys.exit(1)
    return r


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= maxw or not cur: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def caption_png(c, path):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    size = c.get('size', 92); font = ImageFont.truetype(FONT_PIX if c.get('font') == 'pix' else FONT_CAP, size)
    sw = max(6, size // 10) if c.get('font') != 'pix' else max(5, size // 9)
    lines = []
    for part in c['text'].split('\n'): lines += wrap(d, part, font, c.get('maxw', 860))
    lh = int(size * (1.12 if c.get('font') != 'pix' else 1.45)); y0 = int(c.get('y', 380) - lh * len(lines) / 2)
    cols = c.get('colors') or [c.get('color', '#ffffff')] * len(lines)
    for i, ln in enumerate(lines):
        tw = d.textlength(ln, font=font); x = (W - tw) / 2 + c.get('dx', 0)
        d.text((x + 5, y0 + i * lh + 7), ln, font=font, fill=(0, 0, 0, 170), stroke_width=sw, stroke_fill=(0, 0, 0, 170))  # drop shadow
        d.text((x, y0 + i * lh), ln, font=font, fill=cols[i % len(cols)], stroke_width=sw, stroke_fill='#000000')
    img.save(path)


def endcard_png(bg_path, path):
    bg = Image.open(bg_path).convert('RGB').resize((W, H)).filter(ImageFilter.GaussianBlur(18))
    dark = Image.new('RGB', (W, H), (8, 6, 20)); bg = Image.blend(bg, dark, 0.62)
    d = ImageDraw.Draw(bg)
    f1 = ImageFont.truetype(FONT_PIX, 96); f2 = ImageFont.truetype(FONT_CAP, 70); f3 = ImageFont.truetype(FONT_CAP, 46)
    def ctext(t, f, y, fill, sw):
        tw = d.textlength(t, font=f); d.text(((W - tw) / 2 + 6, y + 8), t, font=f, fill='#000000', stroke_width=sw, stroke_fill='#000000')
        d.text(((W - tw) / 2, y), t, font=f, fill=fill, stroke_width=sw, stroke_fill='#000000')
    ctext('TOAD', f1, 560, '#ffd23a', 8); ctext('CITY', f1, 690, '#ffd23a', 8); ctext('BALTIMORE', f1, 820, '#ff6fae', 8)
    ctext('PLAY IT IN YOUR BROWSER', f3, 1010, '#ffffff', 5)
    ctext('toad-city-baltimore.surge.sh', f2, 1080, '#9dff6b', 6)
    bg.save(path)


def main(spec_path):
    S = json.load(open(spec_path)); name = S['name']; wd = f'{B}/work/{name}'; os.makedirs(wd, exist_ok=True)
    if os.environ.get('OUT_DIR'): S['out'] = os.path.join(os.environ['OUT_DIR'], os.path.basename(S['out']))
    segs, t_out, hit_out = [], 0.0, None
    for i, s in enumerate(S['segs']):
        src = f"{B}/raw/{s['src']}/{s['src']}"; sp = s.get('speed', 1.0); a, b = s['a'], s['b']
        vf = [f"trim=start={a}:end={b}", 'setpts=PTS-STARTPTS']
        z = s.get('zoom', 1.0)
        if z != 1.0:
            cw, ch = int(W / z) // 2 * 2, int(H / z) // 2 * 2; cx, cy = s.get('cx', W / 2), s.get('cy', H / 2)
            x = int(min(max(cx - cw / 2, 0), W - cw)); y = int(min(max(cy - ch / 2, 0), H - ch))
            vf += [f'crop={cw}:{ch}:{x}:{y}', f'scale={W}:{H}:flags=lanczos']
        if s.get('gamma'): vf.append(f"eq=gamma={s['gamma']}:brightness={s.get('bright', 0)}")
        if sp != 1.0: vf.append(f'setpts=PTS/{sp}')
        vf += [f'fps={FPS}', 'setsar=1', 'format=yuv420p']
        if s.get('flash'): vf.append(f"fade=t=in:st=0:d={s['flash']}:color=white")
        af = [f'atrim=start={a}:end={b}', 'asetpts=PTS-STARTPTS']
        if sp != 1.0:
            r = sp; parts = []
            while r > 2.0: parts.append('atempo=2.0'); r /= 2.0
            while r < 0.5: parts.append('atempo=0.5'); r /= 0.5
            parts.append(f'atempo={r:.5f}'); af += parts
        dur = round((b - a) / sp * FPS) / FPS
        af += [f'apad', f'atrim=end={dur}', 'aformat=sample_rates=44100:channel_layouts=stereo']
        out = f'{wd}/seg{i:02d}.mp4'
        if not (os.environ.get('REUSE_SEGS') and os.path.exists(out) and os.path.getsize(out) > 0): run(['ffmpeg', '-y', '-v', 'error', '-i', src + '_raw.mp4', '-i', src + '_sfx.wav', '-filter_complex', f"[0:v]{','.join(vf)}[v];[1:a]{','.join(af)}[a]",
             '-map', '[v]', '-map', '[a]', '-t', f'{dur}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-r', str(FPS), '-c:a', 'pcm_s16le', out])
        if S.get('hit') and S['hit']['seg'] == i: hit_out = t_out + (S['hit']['t'] - a) / sp
        segs.append((out, dur)); t_out += dur
    body_dur = t_out
    # concat body
    lst = f'{wd}/list.txt'; open(lst, 'w').write(''.join(f"file '{p}'\n" for p, _ in segs))
    if not (os.environ.get('REUSE_SEGS') and os.path.exists(f'{wd}/body.mov')): run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c:v', 'copy', '-c:a', 'pcm_s16le', f'{wd}/body.mov'])
    # end card
    ec = S.get('endcard_dur', 1.6)
    run(['ffmpeg', '-y', '-v', 'error', '-sseof', '-0.1', '-i', f'{wd}/body.mov', '-frames:v', '1', '-update', '1', f'{wd}/last.png'])
    endcard_png(f'{wd}/last.png', f'{wd}/endcard.png')
    # captions
    caps = []
    for k, c in enumerate(S.get('captions', [])):
        p = f'{wd}/cap{k:02d}.png'; caption_png(c, p); caps.append((p, c['t0'], c['t1']))
    total = body_dur + ec
    inputs = ['-i', f'{wd}/body.mov', '-loop', '1', '-t', f'{ec}', '-framerate', str(FPS), '-i', f'{wd}/endcard.png']
    # captions -> one concat track of composited RGBA stills (single overlay; avoids N looping streams)
    bounds = sorted(set([0.0, total] + [min(max(t, 0), total) for _, a, b in caps for t in (a, b)]))
    cl = []
    for j in range(len(bounds) - 1):
        t0, t1 = bounds[j], bounds[j + 1]
        if t1 - t0 < 1e-3: continue
        mid = (t0 + t1) / 2; img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for p, a, b in caps:
            if a <= mid < b: img = Image.alpha_composite(img, Image.open(p).convert('RGBA'))
        fp = f'{wd}/capc{j:02d}.png'; img.save(fp); cl.append((fp, t1 - t0))
    # frame-exact caption track: each composite still held for an exact frame count, joined with the concat filter
    nfr = [round(b * FPS) - round(a * FPS) for a, b in zip([sum(d for _, d in cl[:i]) for i in range(len(cl))], [sum(d for _, d in cl[:i + 1]) for i in range(len(cl))])]
    cin, cfc = [], []
    for i, ((fp, d), n) in enumerate(zip(cl, nfr)):
        if n <= 0: continue
        cin += ['-loop', '1', '-framerate', str(FPS), '-i', fp]; cfc.append((len(cin) // 6 - 1, n))
    ctrack = f'{wd}/captrack.mov'
    run(['ffmpeg', '-y', '-v', 'error'] + cin + ['-filter_complex', ''.join(f'[{k}:v]trim=end_frame={n},setpts=PTS-STARTPTS,format=rgba[t{k}];' for k, n in cfc) + ''.join(f'[t{k}]' for k, _ in cfc) + f'concat=n={len(cfc)}:v=1:a=0[o]',
         '-map', '[o]', '-c:v', 'qtrle', '-pix_fmt', 'argb', '-r', str(FPS), ctrack])
    inputs += ['-i', ctrack]
    # no concat filter (it dropped/duplicated ~1 s of body frames here): clone-pad the body, lay the end card over the tail
    fc = [f'[1:v]fps={FPS},format=yuv420p,setsar=1,fade=t=in:st=0:d=0.15:color=white,setpts=PTS-STARTPTS+{body_dur:.4f}/TB[ec]',
          f'[0:v]tpad=stop_mode=clone:stop_duration={ec + 0.2:.3f}[bv];[bv][ec]overlay=0:0:eof_action=pass[v0]']
    last = 'v0'
    fc.append(f"[2:v]setpts=PTS-STARTPTS[cc];[{last}][cc]overlay=0:0:eof_action=pass[vc]"); last = 'vc'
    # audio: sfx body + music bed aligned so the hit lands on a downbeat + one-shots
    mus = f"{B}/raw/music/{S.get('music', 'club_a')}.wav"
    if hit_out is None: hit_out = body_dur - 0.5
    k = math.ceil(hit_out / BAR + 1e-6); off = k * BAR - hit_out  # music time = out time + off
    while off < 0: off += BAR
    na = 3
    ain = ['-i', mus, '-i', f'{B}/raw/music/hit.wav', '-i', f'{B}/raw/music/endcard.wav']
    mdb, sdb = S.get('music_db', -9), S.get('sfx_db', 0)
    afc = [f'[0:a]volume={sdb}dB,apad=whole_dur={total}[sfx]',
           f"[{na}:a]atrim=start={off:.4f},asetpts=PTS-STARTPTS,volume={mdb}dB,afade=t=out:st={body_dur - 0.25:.3f}:d=0.35,apad=whole_dur={total}[mus]",
           f'[{na + 1}:a]volume={S.get("hit_db", -2)}dB,adelay={int((hit_out - 0.02) * 1000)}|{int((hit_out - 0.02) * 1000)},apad=whole_dur={total}[hit]',
           f'[{na + 2}:a]volume=-3dB,adelay={int(body_dur * 1000)}|{int(body_dur * 1000)},apad=whole_dur={total}[ecs]']
    mix = ['[sfx]', '[mus]', '[hit]', '[ecs]']
    for j, fx in enumerate(S.get('extra_fx', [])):
        ain += ['-i', f"{B}/raw/music/{fx['wav']}.wav"]; idx = na + 3 + j
        afc.append(f"[{idx}:a]volume={fx.get('db', -4)}dB,adelay={int(fx['t'] * 1000)}|{int(fx['t'] * 1000)},apad=whole_dur={total}[x{j}]"); mix.append(f'[x{j}]')
    afc.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,atrim=end={total},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]")
    out = S['out']; os.makedirs(os.path.dirname(out), exist_ok=True)
    # Audio is rendered on its own to a WAV that starts at 0 and lasts exactly `total` (muxing it in the same graph left
    # the AAC track starting ~1.2 s late), then muxed with the video. REMUX_AUDIO=1 reuses an existing video in `out`.
    awav = f'{wd}/mix.wav'
    run(['ffmpeg', '-y', '-v', 'error', '-i', f'{wd}/body.mov'] + ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'] + ain +
        ['-filter_complex', ';'.join(afc).replace('[a]', ',asetpts=N/SR/TB,apad,atrim=end=%.4f[a]' % total), '-map', '[a]', '-c:a', 'pcm_s16le', awav])
    if os.environ.get('REMUX_AUDIO') and os.path.exists(out):
        vsrc = out + '.v.mp4'; os.replace(out, vsrc)
    else:
        vsrc = f'{wd}/video_only.mp4'
        run(['ffmpeg', '-y', '-v', 'error'] + inputs + ['-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-an',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-profile:v', 'high', '-t', f'{total:.3f}', vsrc])
    run(['ffmpeg', '-y', '-v', 'error', '-i', vsrc, '-i', awav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
         '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', '-t', f'{total:.3f}', out])
    if vsrc.endswith('.v.mp4'): os.remove(vsrc)
    print(json.dumps({'out': out, 'body': round(body_dur, 2), 'total': round(total, 2), 'hit_out': round(hit_out, 3), 'music_off': round(off, 3)}))


if __name__ == '__main__':
    main(sys.argv[1])
