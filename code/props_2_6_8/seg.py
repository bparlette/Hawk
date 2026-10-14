from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(path):
    a=np.array(Image.open(path).convert('RGBA')).astype(np.float32)
    r,g,b,al=[a[...,i] for i in range(4)]
    gex=g-np.maximum(r,b)
    # key any remaining chroma green (works for un-keyed sheets too)
    key=(gex>40)&(g>90)
    soft=(gex>12)&~key
    al=np.where(key,0,al)
    al=np.where(soft,np.minimum(al,np.clip(255-(gex-12)*8,0,255)),al)
    mx=np.maximum(r,b); g=np.where(g>mx,mx+(g-mx)*0.15,g)
    a[...,1]=g; a[...,3]=al
    return a
def comps(a,minpix=400,thr=40):
    m=a[...,3]>thr; lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=int((lab[sl]==i).sum())
        if cnt>=minpix: out.append((i,cnt,sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,sorted(out,key=lambda c:c[2])
def cut(a,lab,c,extra_box=None,merge_small=True,pad=0):
    i,_,x0,y0,x1,y1=c
    m=lab==i
    if extra_box: # merge every labelled px inside box (droplets etc.)
        X0,Y0,X1,Y1=extra_box; sub=np.zeros_like(m); sub[Y0:Y1,X0:X1]=True; m|=(lab>0)&sub
    ys,xs=np.nonzero(m); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    s=a[y0:y1,x0:x1].copy(); s[...,3]=np.where(m[y0:y1,x0:x1],s[...,3],0)
    return s
if __name__=='__main__':
    import sys
    for f in sys.argv[1:]:
        a=load(f); lab,cs=comps(a); print(f,a.shape,[(c[1],c[2:]) for c in cs])
