import json,subprocess,sys,os
parts=json.load(open('cut4/parts.json'))
for i,(n,st,d,fz) in enumerate(parts):
    out=f'cut4/c{i:02d}_{n}.mp4'
    if os.path.exists(out): continue
    nf=round(d*30); vf='setpts=PTS-STARTPTS'
    if fz: vf+=f',tpad=stop_mode=clone:stop_duration={fz}'
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{st:.4f}','-i','../paradise-thunder_v3.mp4','-an','-vf',f'trim=end_frame={nf},'+vf,
         '-c:v','libx264','-preset','ultrafast','-crf','12','-pix_fmt','yuv420p','-r','30',out+'.tmp.mp4']
    subprocess.run(cmd,check=True,timeout=100); os.rename(out+'.tmp.mp4',out); print(out,flush=True)
