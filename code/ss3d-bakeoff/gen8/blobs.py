import sys, numpy as np
from PIL import Image
from scipy import ndimage
def blobs(path):
    a=np.array(Image.open(path).convert('RGBA'))[:,:,3]>40
    d=ndimage.binary_dilation(a,iterations=6)
    lab,n=ndimage.label(d); out=[]
    for i,s in enumerate(ndimage.find_objects(lab)):
        h=s[0].stop-s[0].start; w=s[1].stop-s[1].start
        if h>150: out.append((s[1].start,s[0].start,w,h))
    return sorted(out,key=lambda b:(b[1]//200,b[0]))
if __name__=='__main__':
    for p in sys.argv[1:]: print(p, blobs(p))
