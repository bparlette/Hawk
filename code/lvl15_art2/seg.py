from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(f): return np.array(Image.open(f).convert('RGBA')).astype(np.float32)
def comps(a,minpix=3000):
    m=a[...,3]>40; lab,n=ndi.label(m,structure=np.ones((3,3))); out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append((i,cnt,sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,sorted(out,key=lambda c:c[2])
if __name__=='__main__':
    for f in ['k_elite.png','k_shred_fall.png','k_elite2.png','k_super_new.png','k_shred_new.png']:
        a=load(f); lab,cs=comps(a); print(f,a.shape[:2],[(c[1],c[2:]) for c in cs])
