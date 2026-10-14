# connected components on the keyed generations -> list bboxes
import numpy as np
from PIL import Image
from scipy import ndimage
for n in ['forklift','props','shutter']:
    a=np.array(Image.open(f'l5p_{n}.png'))
    m=a[...,3]>40
    lab,k=ndimage.label(ndimage.binary_dilation(m,iterations=3))
    objs=ndimage.find_objects(lab)
    out=[]
    for i,s in enumerate(objs):
        area=(lab[s]==i+1).sum()
        if area<800: continue
        out.append((s[1].start,s[0].start,s[1].stop-s[1].start,s[0].stop-s[0].start,int(area)))
    print(n,sorted(out))
