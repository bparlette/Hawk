# L3 Gulch Gator: frames from generated sheets -> uniform-scale packed sheet level3_gator.png + meta.json [x,y,w,h,anchorX]
from PIL import Image
import numpy as np, json, os, sys
from scipy import ndimage as ndi
from seg import load, comps
OUT_H_IDLE=200   # idle stored height -> drawn at k=0.5 = 100 world px (old ramrod-based gator was ~100)
SK=json.load(open('sheet_scale.json')) if os.path.exists('sheet_scale.json') else {'A':1,'B':1,'C':1,'D':1,'E':0.8}
sheets={s:load(f'gator_sheet{s}.png') for s in 'ABCDE'}
L={s:comps(sheets[s]) for s in sheets}
spec=[('idle','A',0),('walk1','A',1),('walk2','A',2),('wind','A',3),('punch','D',1),('tele','E',2),('charge','B',1),('throw','B',2),
      ('wave','B',3),('stomp','B',4),('hurt','C',0),('fall','C',1),('down','C',2),('summon','C',3),('leap','C',4),('surf','D',2),('land','E',0),('getup','E',1)]
def frame(s,idx):
    a=sheets[s]; lab,cs=L[s]; c=cs[idx]; m=lab==c[0]
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); mm=m[y0:y1,x0:x1]
    al=np.where(mm,sub[...,3],0).astype(np.float32)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)   # eat 1px of fringe
    rgb=sub[...,:3]; r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    edge=ndi.binary_dilation(al<200,iterations=3)&(al>0)
    chroma=edge&(g>r*1.2+12)&(g>b*1.3+12)
    al=np.where(chroma,al*0.25,al)
    mx=np.maximum(r,b); g2=np.where(edge&(g>mx+8), mx+8+(g-mx-8)*0.2, g)  # despill edge band only (keeps olive scales / sludge interior)
    # B stomp + B tele: drop dust (light brown, low sat, bottom-most) - not used; nothing else
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
    yel=(a>150)&(r>110)&(g>80)&(b<90)&(r-b>60)
    yy=np.mgrid[0:hh,0:ww][0]
    lum=(r+g+b)/3; sat=np.maximum(np.maximum(r,g),b)-np.minimum(np.minimum(r,g),b)
    boot=(a>150)&(lum<60)&(sat<35)&(yy>hh*0.82)
    if name in('down','fall','leap'):
        ys,xs=np.nonzero(yel); ax=int(np.median(xs)) if len(xs) else ww//2
    else:  # stance centre: mid-point between the left-most and right-most boot columns (hip sits over it)
        yc=np.nonzero((yel&(yy>hh*0.5)&(yy<hh*0.85)).sum(0)>2)[0]
        cols=np.nonzero(boot.sum(0)>3)[0]
        if len(yc): cols=cols[(cols>=yc.min()-12)&(cols<=yc.max()+12)]
        ax=int((cols.min()+cols.max())/2) if len(cols) else ww//2
    meta[name]=[x,y,ww,hh,ax]; x+=ww+4
sheet.save('gator_rgba.png')
q=sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('level3_gator.png',optimize=True)
meta['down'][4]=meta['down'][2]//2  # lying: body centre
json.dump(meta,open('meta.json','w'))
print(sheet.size,os.path.getsize('level3_gator.png')); print(json.dumps(meta))
