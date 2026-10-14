from PIL import Image
import numpy as np
from collections import deque
src=Image.open('lvl10_gen_shark.png').convert('RGB')
im=np.array(src).astype(int)
r,g,b=im[...,0],im[...,1],im[...,2]
# green-ness for soft key
gk=g-np.maximum(r,b)
key=(gk>40)&(g>110)
fg=~key
H,W=fg.shape
lab=np.zeros((H,W),int); n=0; comps=[]
for y in range(0,H):
  row=fg[y]
  for x in np.where(row & (lab[y]==0))[0]:
    if lab[y,x]: continue
    n+=1; q=deque([(y,x)]); lab[y,x]=n; cnt=0; x0=x1=x; y0=y1=y
    while q:
      cy,cx=q.popleft(); cnt+=1
      x0=min(x0,cx);x1=max(x1,cx);y0=min(y0,cy);y1=max(y1,cy)
      for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny,nx=cy+dy,cx+dx
        if 0<=ny<H and 0<=nx<W and fg[ny,nx] and not lab[ny,nx]:
          lab[ny,nx]=n; q.append((ny,nx))
    comps.append((n,cnt,x0,x1,y0,y1))
big=[c for c in comps if c[1]>5000]
for c in big: print(c)
np.save('lab.npy',lab)
import json; json.dump(big,open('comps.json','w'))
