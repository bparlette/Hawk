from PIL import Image;import numpy as np
from scipy import ndimage
import sys
def clean(f):
  a=np.array(Image.open(f).convert('RGB')).astype(int)
  H,W,_=a.shape
  m=(a.min(2)>225)
  lab,n=ndimage.label(m)
  boxes=[]
  for s in ndimage.find_objects(lab):
    h=s[0].stop-s[0].start;w=s[1].stop-s[1].start
    if 8<h<30 and 25<w<130 and s[0].start>300: boxes.append((s[0].start-10,s[0].stop+9,s[1].start-6,s[1].stop+9))
  # stats box: dark region top-left
  d=(a.max(2)<110)
  l2,_=ndimage.label(d)
  k=l2[12,12]
  if k:
    ys,xs=np.where(l2==k); boxes.append((0,ys.max()+4,0,xs.max()+4))
  for y0,y1,x0,x1 in boxes:
    # fill each row with the colour from a clean column just right (or left) of the box
    for y in range(max(0,y0),min(H,y1)):
      cands=[a[y,max(0,x0-8)],a[y,min(W-1,x1+8)],a[y,max(0,x0-20)],a[y,min(W-1,x1+20)]]
      a[y,max(0,x0):x1]=max(cands,key=lambda c:int(c.sum()))
  return a.astype('uint8'),boxes
if __name__=='__main__':
  a,b=clean(sys.argv[1]); print(b); Image.fromarray(a).save(sys.argv[2])
