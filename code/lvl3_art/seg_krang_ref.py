from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(name):
    a=np.array(Image.open(name).convert('RGBA')).astype(np.float32)
    if name.endswith('A.png'):
        rgb=a[...,:3]; mn=rgb.min(-1); mx=rgb.max(-1)
        cand=(mn>228)&((mx-mn)<14)
        lab,n=ndi.label(cand)
        border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        sizes=np.bincount(lab.ravel())
        big=set(np.nonzero(sizes>150)[0])-{0}
        cand2=(mn>238)&((mx-mn)<10)
        lab2,n2=ndi.label(cand2); s2=np.bincount(lab2.ravel()); big2=set(np.nonzero(s2>120)[0])-{0}
        bg=np.isin(lab,list(border))|np.isin(lab2,list(big2))
        fg=~bg
        # soft edge: pixels within 2px of bg get alpha from whiteness
        dist=ndi.distance_transform_edt(fg)
        whit=np.clip((255-mn)/45.0,0,1)
        al=np.where(dist<=2, np.maximum(whit, 0)*1.0, 1.0); al=np.where(fg,al,0)
        # unmix white
        A=al[...,None]; rgb2=np.where(A>0.02,(rgb-(1-A)*255)/np.maximum(A,1e-3),0)
        a[...,:3]=np.clip(rgb2,0,255); a[...,3]=al*255
    return a
def comps(a,minpix=3000):
    m=a[...,3]>40; lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append((i,cnt,sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,sorted(out,key=lambda c:c[2])
if __name__=='__main__':
    for s in 'ABCD':
        a=load(f'krang_sheet{s}.png'); lab,cs=comps(a)
        print(s,a.shape,[(c[1],c[2:]) for c in cs])
