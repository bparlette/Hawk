from PIL import Image, ImageDraw
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
OUT_H_IDLE=200   # stored idle height; drawn at RM_K=101/200
sheets={s:load(f'rust_sheet{s}.png') for s in 'ABCD'}
labs={}; cs={}
for s,a in sheets.items(): labs[s],cs[s]=comps(a)
def frame(s,idx):
    a=sheets[s]; m=labs[s]==cs[s][idx][0]
    lab,n=ndi.label(m,structure=np.ones((3,3)))
    if n>1:
        sz=ndi.sum(m,lab,range(1,n+1)); m=lab==(np.argmax(sz)+1)
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); mm=m[y0:y1,x0:x1]
    al=np.where(mm,sub[...,3],0).astype(np.float32)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,b)
    g=np.where(g>mx+6, mx+(g-mx)*0.15, g)   # despill chroma green
    return np.dstack([r,g,b,al]).clip(0,255).astype(np.uint8)
idleH={s:frame(s,0).shape[0] for s in 'ABCD'}
print('idleH',idleH)
spec=[('idle','A',0),('walk1','A',1),('walk2','A',2),('walk3','A',3),('rush','B',1),('wind','B',2),('swing','B',3),('throw','B',4),
      ('slamUp','C',1),('slamDn','C',2),('summon','C',3),('pull','C',4),('hurt','D',1),('down','D',2)]
imgs=[]
for name,s,idx in spec:
    f=frame(s,idx); k=OUT_H_IDLE/idleH[s]*(1.12 if name=='down' else 1)
    im=Image.fromarray(f,'RGBA'); im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
    imgs.append((name,im))
Wt=sum(im.width+4 for _,im in imgs); Ht=max(im.height for _,im in imgs)
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0; meta={}
for name,im in imgs:
    y=Ht-im.height; sheet.paste(im,(x,y)); A=np.asarray(im).astype(int)
    r,g,b,a=[A[...,i] for i in range(4)]; h,w=a.shape
    # trousers: low-saturation grey, mid luminance, in the hip band
    sat=np.maximum(np.maximum(r,g),b)-np.minimum(np.minimum(r,g),b); lum=(r+g+b)/3
    tr=(a>150)&(sat<28)&(lum>55)&(lum<150)
    yy=np.mgrid[0:h,0:w][0]; band=(yy>h*0.50)&(yy<h*0.66)
    ys,xs=np.nonzero(tr&band)
    ax=int(np.median(xs)) if len(xs)>80 and name!='down' else w//2
    if name=='slamDn': ax=round(w*0.36)  # crouch: hip centre by eye (trouser median caught the forward knee)
    meta[name]=[x,y,im.width,im.height,ax]; x+=im.width+4
sheet.save('rust_rgba.png')
sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG).save('level7_rustmaul.png',optimize=True); print('png',os.path.getsize('level7_rustmaul.png'))
json.dump(meta,open('meta.json','w')); print(sheet.size); print(json.dumps(meta))
