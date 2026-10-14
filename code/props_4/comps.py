from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def comps(name, minpix=1500):
    a=np.array(Image.open(name).convert('RGBA'))
    m=a[...,3]>40; m=ndi.binary_closing(m,iterations=2)
    lab,n=ndi.label(m,structure=np.ones((3,3)))
    out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=int((lab[sl]==i).sum())
        if cnt>=minpix: out.append(dict(id=i,cnt=cnt,x0=sl[1].start,y0=sl[0].start,x1=sl[1].stop,y1=sl[0].stop))
    return a,lab,out
if __name__=='__main__':
    for n in ['cars','trucks','rig','props','road']:
        a,lab,cs=comps(f'p4_{n}.png'); print(n,[(c['cnt'],c['x0'],c['y0'],c['x1'],c['y1']) for c in cs])
