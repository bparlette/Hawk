# L2 Brickjaw: frames -> uniform-scale packed sheet level2_brickjaw.png + meta.json [x,y,w,h,anchorX]
from PIL import Image
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
OUT_H_IDLE=180   # idle stored height -> drawn at k=0.5 = 90 world px (old tinted ramrod x1.05 was ~90)
SK={'A':1.0,'B':1.0,'C':1.12}
sheets={s:load(f'brick_sheet{s}.png') for s in 'ABC'}
L={s:comps(sheets[s]) for s in sheets}
spec=[('idle','A',0),('walk1','A',1),('walk2','C',4),('wind','A',3),('punch','B',0),('tele','B',1),('charge','B',2),
      ('throwUp','B',3),('throwRel','B',4),('summon','B',5),('hurt','C',0),('fall','C',1),('down','C',2),('getup','C',3)]
def frame(s,idx):
    a=sheets[s]; lab,cs=L[s]; c=cs[idx]; m=lab==c[0]
    m=ndi.binary_dilation(m,iterations=2)&(a[...,3]>0)
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); mm=m[y0:y1,x0:x1]
    al=np.where(mm,sub[...,3],0).astype(np.float32)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    rgb=sub[...,:3]; r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    edge=ndi.binary_dilation(al<200,iterations=3)&(al>0)
    chroma=edge&(g>r*1.2+12)&(g>b*1.3+12)
    al=np.where(chroma,al*0.25,al)
    mx=np.maximum(r,b); g2=np.where(edge&(g>mx+8), mx+8+(g-mx-8)*0.2, g)
    return np.dstack([r,g2,b,al]).clip(0,255).astype(np.uint8)
idleH=frame('A',0).shape[0]; base=OUT_H_IDLE/idleH
imgs=[]
for name,s,idx in spec:
    f=frame(s,idx); k=base*SK[s]
    im=Image.fromarray(f,'RGBA'); im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
    imgs.append((name,im))
Wt=sum(im.width+4 for _,im in imgs); Ht=max(im.height for _,im in imgs)
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0; meta={}
for name,im in imgs:
    y=Ht-im.height; sheet.paste(im,(x,y)); A=np.asarray(im).astype(int); hh,ww=A.shape[:2]
    r,g,b,a=[A[...,i] for i in range(4)]
    yy=np.mgrid[0:hh,0:ww][0]
    lum=(r+g+b)/3; sat=np.maximum(np.maximum(r,g),b)-np.minimum(np.minimum(r,g),b)
    boot=(a>150)&(lum<55)&(sat<30)&(yy>hh*0.80)
    cols=np.nonzero(boot.sum(0)>3)[0]
    if name in('down','fall'): ax=ww//2
    else: ax=int((cols.min()+cols.max())/2) if len(cols) else ww//2
    meta[name]=[x,y,ww,hh,ax]; x+=ww+4
sheet.save('brick_rgba.png')
q=sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('level2_brickjaw.png',optimize=True)
json.dump(meta,open('meta.json','w'))
print(sheet.size,os.path.getsize('level2_brickjaw.png')); print(json.dumps(meta))
