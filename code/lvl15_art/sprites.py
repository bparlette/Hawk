from PIL import Image
import numpy as np, os, json
from collections import deque
def comps(A, minpix=2000):
    m=A>40; H,W=m.shape; lab=np.zeros((H,W),np.int32); n=0; out=[]
    ys,xs=np.nonzero(m)
    for y0,x0 in zip(ys,xs):
        if lab[y0,x0]: continue
        n+=1; q=deque([(y0,x0)]); lab[y0,x0]=n; cnt=0; x1=x2=x0; y1=y2=y0
        while q:
            y,x=q.popleft(); cnt+=1
            x1=min(x1,x);x2=max(x2,x);y1=min(y1,y);y2=max(y2,y)
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                yy,xx=y+dy,x+dx
                if 0<=yy<H and 0<=xx<W and m[yy,xx] and not lab[yy,xx]: lab[yy,xx]=n; q.append((yy,xx))
        out.append((n,cnt,x1,y1,x2+1,y2+1))
    return lab,out
def build(src, names, H_T, out, order_key):
    im=Image.open(src).convert('RGBA'); a=np.asarray(im); A=a[:,:,3]
    lab,cs=comps(A)
    big=[c for c in cs if c[1]>3000]
    small=[c for c in cs if c[1]<=3000]
    big.sort(key=order_key)
    print([ (c[1],c[2:]) for c in big])
    frames=[]
    for c in big:
        n,_,x1,y1,x2,y2=c
        mask=(lab==n)
        # attach small fragments whose bbox lies within this frame's bbox (blades, sparks)
        for s in small:
            if s[2]>=x1-10 and s[4]<=x2+10 and s[3]>=y1-10 and s[5]<=y2+10: mask|=(lab==s[0])
        ys,xs=np.nonzero(mask); x1,x2,y1,y2=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        arr=a[y1:y2,x1:x2].copy(); arr[:,:,3]=np.where(mask[y1:y2,x1:x2],arr[:,:,3],0)
        frames.append(Image.fromarray(arr))
    return frames
def pack(frames, names, H_T, out, anchors_rows=(0.3,0.7)):
    # uniform scale so the first (idle) frame is H_T tall
    k=H_T/frames[0].height
    fr=[f.resize((max(1,round(f.width*k)),max(1,round(f.height*k))),Image.LANCZOS) for f in frames]
    W=sum(f.width+4 for f in fr); H=max(f.height for f in fr)
    sheet=Image.new('RGBA',(W,H),(0,0,0,0)); x=0; meta={}
    for nm,f in zip(names,fr):
        y=H-f.height; sheet.paste(f,(x,y)); A=np.asarray(f)[:,:,3]
        r0,r1=int(f.height*anchors_rows[0]),int(f.height*anchors_rows[1]); ys,xs=np.nonzero(A[r0:r1]>100)
        ax=int(round(xs.mean())) if len(xs) else f.width//2
        meta[nm]=[x,y,f.width,f.height,ax]; x+=f.width+4
    # de-fringe: kill green spill
    s=np.asarray(sheet).copy(); r,g,b,al=[s[:,:,i].astype(int) for i in range(4)]
    spill=(g>r+30)&(g>b+30)&(al<250); s[spill,3]=(s[spill,3]*0.3).astype('uint8')
    Image.fromarray(s).save(out,optimize=True); print(out,sheet.size,os.path.getsize(out)); return meta
