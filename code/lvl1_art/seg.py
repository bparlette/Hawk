from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(name):
    a=np.array(Image.open(name).convert('RGBA')).astype(np.float32)
    if name.endswith('B.png'):   # generator left a white / pale-green backdrop: key by border flood
        rgb=a[...,:3]; mn=rgb.min(-1); mx=rgb.max(-1); r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
        cand=(a[...,3]<20)|((mn>200)&(g>=r-6)&(g>=b-6))|((g-np.maximum(r,b)>10)&(g>170))
        lab,n=ndi.label(cand)
        border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        sz=np.bincount(lab.ravel()); big=set(np.nonzero(sz>400)[0])-{0}
        bg=np.isin(lab,list(border|big))
        fg=~bg
        dist=ndi.distance_transform_edt(fg)
        whit=np.clip((255-mn)/60.0,0,1)
        al=np.where(dist<=2,whit,1.0); al=np.where(fg,al,0)
        A=al[...,None]; rgb2=np.where(A>0.02,(rgb-(1-A)*255)/np.maximum(A,1e-3),0)
        a[...,:3]=np.clip(rgb2,0,255); a[...,3]=al*255
    return a
def comps(a,minpix=2000):
    m=a[...,3]>40; lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append((i,cnt,sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,sorted(out,key=lambda c:c[2])
if __name__=='__main__':
    for s in 'ABC':
        a=load(f'scorch_{s}.png'); lab,cs=comps(a)
        print(s,[(c[1],c[2:]) for c in cs])
        if s=='B': Image.fromarray(a.astype(np.uint8)).save('view_B_keyed.png')
