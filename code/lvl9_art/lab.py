from PIL import Image
import numpy as np
from collections import deque
im=np.array(Image.open('gen_l9_karai.png').convert('RGBA'))
a=im[:,:,3]>40
H,W=a.shape
lab=np.zeros((H,W),int); n=0; out=[]
for y in range(H):
  for x in range(W):
    if a[y,x] and not lab[y,x]:
      n+=1; q=deque([(y,x)]); lab[y,x]=n; xs=[];ys=[]
      while q:
        cy,cx=q.popleft(); xs.append(cx); ys.append(cy)
        for dy in (-2,-1,0,1,2):
          for dx in (-2,-1,0,1,2):
            ny,nx=cy+dy,cx+dx
            if 0<=ny<H and 0<=nx<W and a[ny,nx] and not lab[ny,nx]:
              lab[ny,nx]=n; q.append((ny,nx))
      if len(xs)>150: out.append((n,min(xs),max(xs),min(ys),max(ys),len(xs)))
for o in out: print(o)
np.save('lab.npy',lab)
