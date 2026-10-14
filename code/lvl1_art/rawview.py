from PIL import Image; import numpy as np
from seg import load, comps
ims=[]
for s in 'ABC':
    a=load(f'scorch_{s}.png'); lab,cs=comps(a)
    for j,c in enumerate(cs):
        x0,y0,x1,y1=c[2:]; sub=a[y0:y1,x0:x1].copy(); sub[...,3]*= (lab[y0:y1,x0:x1]==c[0]) | (sub[...,3]>0)
        ims.append((s+str(j),Image.fromarray(sub.clip(0,255).astype(np.uint8))))
idle=ims[0][1]
W=sum(i.width+idle.width+30 for _,i in ims); H=470
out=Image.new('RGBA',(W,H),(40,40,90,255)); x=0
from PIL import ImageDraw; d=ImageDraw.Draw(out)
for n,i in ims:
    out.alpha_composite(idle,(x,H-idle.height)); out.alpha_composite(i,(x+idle.width,H-i.height)); d.text((x+5,5),n,fill=(255,255,0)); x+=i.width+idle.width+30
out=out.convert('RGB'); out.resize((out.width//3,out.height//3)).save('view/raw.png'); print(out.size)
