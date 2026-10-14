# Razorback sheet: rz_sheetA/B/C (chroma-keyed gens) -> level8_razorback.png + meta.json {name:[x,y,w,h,anchorX]}
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
IDLE_H=190
sheets={s:load(s) for s in 'ABC'}; L={s:comps(sheets[s]) for s in 'ABC'}
def frame(s,idx):
    a=sheets[s]; lab,cs=L[s]; m=lab==cs[idx][0]
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); al=np.where(m[y0:y1,x0:x1],sub[...,3],0)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)  # soften 1px fringe
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,b)
    g=np.where(g>mx, mx+(g-mx)*0.12, g)  # despill chroma green
    return np.dstack([r,g,b,al]).clip(0,255).astype(np.uint8)
spec=[('idle','A',0),('walk1','A',1),('walk2','A',2),('guard','A',3),('wind','A',4),('punch','A',5),
      ('charge','B',0),('leap','B',1),('slam','B',2),('throw','B',3),('fire','B',4),
      ('summon','C',0),('hurt','C',1),('down','C',2),('ko','C',3),('getup','C',4)]
k=IDLE_H/frame('A',0).shape[0]
imgs=[]
for n,s,i in spec:
    im=Image.fromarray(frame(s,i),'RGBA')
    if n in('down','ko'): im=im.transpose(Image.FLIP_LEFT_RIGHT)  # head away from the facing direction, like the old rotated KO
    im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS); imgs.append((n,im))
W=sum(im.width+4 for _,im in imgs); H=max(im.height for _,im in imgs)
sheet=Image.new('RGBA',(W,H),(0,0,0,0)); x=0; meta={}
for n,im in imgs:
    y=H-im.height; sheet.paste(im,(x,y)); A=np.asarray(im).astype(int); h,w=A.shape[:2]
    r,g,b,a=[A[...,c] for c in range(4)]
    body=(a>120)&~((r>g+25)&(b>g+25))   # not the purple cape
    band=np.zeros_like(body); band[int(h*0.45):int(h*0.62)]=True
    ys,xs=np.nonzero(body&band)
    ax=w//2 if n in('down','ko') or len(xs)<50 else int(np.median(xs))
    meta[n]=[x,y,w,h,ax]; x+=w+4
sheet.save('rz_rgba.png')
q=sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG); q.save('level8_razorback.png',optimize=True)
json.dump(meta,open('meta.json','w')); print(sheet.size,os.path.getsize('level8_razorback.png')); print(json.dumps(meta))
