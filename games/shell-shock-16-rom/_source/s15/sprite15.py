# Reimplementation of the user's 15-colour Genesis sprite process (Path B, direct conversion).
import sys, argparse, numpy as np
from PIL import Image, ImageEnhance
from collections import deque
LV=np.array([0,36,72,109,145,182,218,255])
def snap(c): c=np.asarray(c,float); return LV[np.abs(c[...,None]-LV).argmin(-1)].astype(np.uint8)
def bg_flood(rgb,tol=40):
    h,w,_=rgb.shape; ref=rgb[0,0].astype(int); near=np.sqrt(((rgb.astype(int)-ref)**2).sum(2))<tol
    bg=np.zeros((h,w),bool); q=deque()
    for x in range(w):
        for y in (0,h-1):
            if near[y,x] and not bg[y,x]: bg[y,x]=1; q.append((y,x))
    for y in range(h):
        for x in (0,w-1):
            if near[y,x] and not bg[y,x]: bg[y,x]=1; q.append((y,x))
    while q:
        y,x=q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            yy,xx=y+dy,x+dx
            if 0<=yy<h and 0<=xx<w and near[yy,xx] and not bg[yy,xx]: bg[yy,xx]=1; q.append((yy,xx))
    return ~bg
MODES={'dark':dict(b=1.08,c=1.10,s=1.0,anch=[(36,72,182),(145,145,145),(0,0,0)]),
       'bright':dict(b=1.25,c=1.15,s=1.7,anch=[(36,109,255),(218,218,218),(0,0,0)])}
def convert(im,H=96,mode='dark',tol=40):
    im=im.convert('RGBA'); rgb=np.array(im)[:,:,:3]; a=np.array(im)[:,:,3]
    mask=(a>110) if (a<250).any() else bg_flood(rgb,tol)          # step 2
    m=MODES[mode]; p=Image.fromarray(rgb)                          # step 3
    p=ImageEnhance.Brightness(p).enhance(m['b']); p=ImageEnhance.Contrast(p).enhance(m['c']); p=ImageEnhance.Color(p).enhance(m['s'])
    flat=p.quantize(24,method=Image.MEDIANCUT,dither=Image.NONE).convert('RGB')   # step 4
    w,h=im.size; W=max(1,round(w*H/h))
    sm=np.array(flat.resize((W,H),Image.NEAREST)); ma=np.array(Image.fromarray(mask.astype(np.uint8)*255).resize((W,H),Image.NEAREST))>0  # step 5
    pal12=np.array(Image.fromarray(sm).quantize(12,method=Image.MEDIANCUT,dither=Image.NONE).getpalette()[:36]).reshape(12,3)  # step 6
    pal=snap(np.vstack([pal12,np.array(m['anch'])])).astype(int)
    d=((sm[:,:,None,:].astype(int)-pal[None,None])**2).sum(-1); out=np.zeros((H,W,4),np.uint8)
    out[:,:,:3]=pal[d.argmin(-1)]; out[:,:,3]=ma*255; return Image.fromarray(out), pal
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('input'); ap.add_argument('--out',default='sprite'); ap.add_argument('--mode',default='dark')
    ap.add_argument('--label-crop',type=int,default=0); ap.add_argument('--height',type=int,default=96); ap.add_argument('--bg-tol',type=int,default=40)
    A=ap.parse_args(); im=Image.open(A.input); im=im.crop((0,A.label_crop,im.size[0],im.size[1]))  # step 1
    s,pal=convert(im,A.height,A.mode,A.bg_tol); s.save(A.out+'.png')
    bgc=Image.new('RGBA',(s.size[0]*4+16,s.size[1]*4+16),(26,14,44,255)); bgc.alpha_composite(s.resize((s.size[0]*4,s.size[1]*4),Image.NEAREST),(8,8)); bgc.convert('RGB').save(A.out+'_4x.png')
    print(A.out, s.size, 'colours', len({tuple(c) for c in np.array(s)[np.array(s)[:,:,3]>0][:,:3]}))
