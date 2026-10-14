# Edit: frame sequences -> segments (overlays) -> concat -> original score -> final mp4
import json, subprocess, os, sys
FR = 30; OUT = '/workspace/work/shorts/cinema-city'; os.makedirs(f'{OUT}/seg', exist_ok=True)
SEGS = json.load(open(f'{OUT}/edit.json'))
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); sys.exit(1)
t = 0; tl = {'sections': [], 'hits': [], 'whooshes': []}; lst = []
only = sys.argv[1:]
for i, S in enumerate(SEGS):
    name = f'{OUT}/seg/s{i:02d}.mp4'; lst.append(name)
    ranges = S['ranges']  # [[dir, start, end_inclusive], ...]
    nfr = sum(b - a + 1 for _, a, b in ranges); dur = nfr / FR
    # concat list of explicit frames
    fl = f'{OUT}/seg/s{i:02d}.txt'
    with open(fl, 'w') as f:
        for d, a, b in ranges:
            for k in range(a, b + 1): f.write(f"file '{OUT}/frames/{d}/f{k:04d}.jpg'\nduration {1/FR:.6f}\n")
        f.write(f"file '{OUT}/frames/{ranges[-1][0]}/f{ranges[-1][2]:04d}.jpg'\n")
    inputs = ['-f', 'concat', '-safe', '0', '-i', fl]; fc = ['[0:v]fps=30,setsar=1,format=yuv420p']
    if S.get('bg'): fc[0] = '[0:v]fps=30,setsar=1,boxblur=18:2,eq=brightness=-0.08,format=yuv420p'
    fc[0] += '[v0]'; last = 'v0'
    for j, (png, a, b) in enumerate(S.get('ov', [])):
        inputs += ['-loop', '1', '-t', f'{dur:.3f}', '-i', f'{OUT}/ov/{png}']
        fd = 0.12
        fc.append(f'[{j+1}:v]format=rgba,fade=t=in:st={a}:d={fd}:alpha=1,fade=t=out:st={max(a, b - fd)}:d={fd}:alpha=1[o{j}]')
        fc.append(f'[{last}][o{j}]overlay=0:0:enable=\'between(t,{a},{b})\'[v{j+1}]'); last = f'v{j+1}'
    if S.get('flash'):
        for ft in S['flash']: fc.append(f"[{last}]eq=brightness='if(between(t,{ft},{ft+0.07}),0.35,0)':eval=frame[f{last}]"); last = 'f' + last
    if not only or str(i) in only:
        run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-frames:v', str(nfr), '-r', '30',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', name])
    tl['sections'].append([t, t + dur, S['music']])
    for h in S.get('hits', []): tl['hits'].append(t + h)
    if S.get('whoosh'): tl['whooshes'].append(t)
    print(i, S['music'], f'{t:.2f}-{t+dur:.2f}', nfr); t += dur
tl['dur'] = t; json.dump(tl, open(f'{OUT}/timeline.json', 'w'), indent=1)
run(['python3', f'{OUT}/synth.py', f'{OUT}/timeline.json', f'{OUT}/seg/music.wav'])
with open(f'{OUT}/seg/list.txt', 'w') as f: f.writelines(f"file '{n}'\n" for n in lst)
run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/seg/list.txt', '-c', 'copy', f'{OUT}/seg/video.mp4'])
run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/seg/video.mp4', '-i', f'{OUT}/seg/music.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
     '-c:a', 'aac', '-b:a', '192k', '-af', 'loudnorm=I=-15:TP=-1.5:LRA=11', '-ar', '48000', '-shortest', '-movflags', '+faststart', '/tmp/ccs_final.mp4'])
subprocess.run(['cp', '/tmp/ccs_final.mp4', f'{OUT}/cinema_city_short.mp4'], check=True)
print('total', t)
