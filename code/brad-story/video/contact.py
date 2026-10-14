import json, subprocess
from PIL import Image, ImageDraw
tl=json.load(open('timeline.json'))['scenes']
times=[]
for k,(s,d) in tl.items():
    times.append((k, round(s+d*0.75,2)))
W,H=270,480; cols=6
rows=(len(times)+cols-1)//cols
G=Image.new('RGB',(cols*W,rows*(H+22)),'black'); D=ImageDraw.Draw(G)
for i,(k,t) in enumerate(times):
    f=f'/tmp/bs_c{i}.png'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i','../paradise-thunder.mp4','-frames:v','1','-vf',f'scale={W}:{H}',f],check=True,timeout=60)
    x=(i%cols)*W; y=(i//cols)*(H+22)
    G.paste(Image.open(f),(x,y)); D.text((x+4,y+H+4),f'{k} @ {t}s',fill='white')
G.save('../contact.png'); print(G.size)
