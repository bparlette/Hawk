# L2 Brickjaw: generated sheets are already alpha-keyed RGBA -> connected components (sorted left->right)
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def load(name): return np.array(Image.open(name).convert('RGBA')).astype(np.float32)
def comps(a,minpix=3000):
    m=a[...,3]>40; m=ndi.binary_closing(m,iterations=2); lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append((i,int(cnt),sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,sorted(out,key=lambda c:c[2])
if __name__=='__main__':
    for s in 'ABC':
        a=load(f'brick_sheet{s}.png'); lab,cs=comps(a)
        print(s,a.shape,[(c[1],c[2:],'h',c[5]-c[3]) for c in cs])
