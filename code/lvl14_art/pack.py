from PIL import Image, ImageFilter
import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
OUT_H_IDLE=192      # stored idle height (incl. antenna) -> drawn at k=0.5 = 96 world px
sheets={s:load(f'krang_sheet{s}.png') for s in 'ABCD'}
labs={}; cs={}
for s,a in sheets.items(): labs[s],cs[s]=comps(a)
def comp_mask(s,idx):  # idx = order left->right among big comps
    c=cs[s][idx]; return labs[s]==c[0]
def frame(s,idx,split=None):
    a=sheets[s]; m=comp_mask(s,idx)
    if split is not None:
        H,W=m.shape; yy,xx=np.mgrid[0:H,0:W]
        d1=((yy<260)&(xx<496))|(xx<420)
        m=m&(d1 if split==1 else ~d1)
    # keep largest piece only
    lab,n=ndi.label(m,structure=np.ones((3,3)))
    if n>1:
        sz=ndi.sum(m,lab,range(1,n+1)); keep=np.argmax(sz)+1; m=lab==keep
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[y0:y1,x0:x1].copy(); mm=m[y0:y1,x0:x1]
    al=np.where(mm,sub[...,3],0).astype(np.float32)
    # erode 1px of fringe
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    rgb=sub[...,:3]
    # kill leftover chroma-green blobs in the lower body (generation artefacts)
    hh=rgb.shape[0]; low=np.zeros(al.shape,bool); low[int(hh*0.45):]=True
    gr=(rgb[...,1]>np.maximum(rgb[...,0],rgb[...,2])+18)&low
    gr=ndi.binary_dilation(gr,iterations=2)&(rgb[...,1]>np.maximum(rgb[...,0],rgb[...,2])-4)&low
    al=np.where(gr,0,al)
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]; mx=np.maximum(r,b)
    g=np.where(g>mx, mx+(g-mx)*0.15, g)   # despill green (antenna turns steel-grey)
    rgb=np.dstack([r,g,b])
    return np.dstack([rgb,al]).clip(0,255).astype(np.uint8)
def h_of(f): return f.shape[0]
punchH={'A':h_of(frame('A',3)),'B':h_of(frame('B',0)),'C':h_of(frame('C',0)),'D':h_of(frame('D',0,split=1))}
idleH=h_of(frame('A',0)); base=OUT_H_IDLE/idleH
print('punchH',punchH,'idleH',idleH)
spec=[('idle','A',0,None),('walk1','A',1,None),('walk2','D',1,None),('walk3','A',2,None),('wind','D',0,2),('punch','A',3,None),('rocket','A',4,None),
      ('stompUp','B',1,None),('stompDn','B',2,None),('summon','B',3,None),('rage','B',4,None),('hurt','B',5,None),('fall','C',2,None),('down','D',2,None)]
imgs=[]
for name,s,idx,sp in spec:
    f=frame(s,idx,sp); k=base*punchH['A']/punchH[s]
    if name=='down': k=(108*2)/f.shape[1]
    im=Image.fromarray(f,'RGBA')
    # premultiply-safe resize
    im=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
    imgs.append((name,im))
# empty body: copy of down with the brain painted out (dark glass)
dn=np.array(dict(imgs)['down']).astype(np.float32)
r,g,b,a=[dn[...,i] for i in range(4)]
H,W=a.shape
pink=(r>120)&(r-g>35)&(b>g-5)&(a>200)&(r<250)
yy,xx=np.mgrid[0:H,0:W]
# restrict to the window area (upper middle of the body)
pink&=(xx>W*0.45)&(xx<W*0.75)&(yy<H*0.55)
lab,n=ndi.label(ndi.binary_dilation(pink,iterations=2))
if n:
    sz=ndi.sum(pink,lab,range(1,n+1)); keep=np.argmax(sz)+1; win=ndi.binary_dilation(lab==keep,iterations=1)&(a>200)
    ys,xs=np.nonzero(win); print('empty window px',win.sum(),xs.min(),xs.max(),ys.min(),ys.max())
    lum=(r+g+b)/3
    sh=0.55+0.45*(lum/255)
    dn[win,0]=40*sh[win]; dn[win,1]=12*sh[win]; dn[win,2]=24*sh[win]
imgs.append(('empty',Image.fromarray(dn.clip(0,255).astype(np.uint8),'RGBA')))
# pack in one row, feet on bottom
Wt=sum(im.width+4 for _,im in imgs); Ht=max(im.height for _,im in imgs)
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0; meta={}
for name,im in imgs:
    y=Ht-im.height; sheet.paste(im,(x,y)); A=np.asarray(im)
    al=A[...,3]>100; r,g,b=[A[...,i].astype(int) for i in range(3)]
    gold=al&(r>140)&(r-b>110)&(g>r*0.6)&(r>=g)
    hh=im.height; band=np.zeros_like(gold); band[int(hh*0.3):int(hh*0.75)]=True
    gy,gx=np.nonzero(gold&band)
    if name in('down','empty'):
        ax=int(im.width*0.55); wx,wy=(int(np.median(gx)),int(np.median(gy))) if len(gx) else (ax,hh//2)
    else:
        ax=int(np.median(gx)) if len(gx) else im.width//2
        wx,wy=(int(np.median(gx)),int(np.median(gy))) if len(gx) else (ax,int(hh*0.5))
    meta[name]=[x,y,im.width,im.height,ax,wx,wy]
    x+=im.width+4
sheet.save('krang_rgba.png')
s=np.asarray(sheet).copy()
q=sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('level14_krang.png',optimize=True)
print(sheet.size,os.path.getsize('level14_krang.png'))
json.dump(meta,open('meta.json','w'))
print(json.dumps(meta))
