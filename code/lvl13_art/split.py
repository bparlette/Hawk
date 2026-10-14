from PIL import Image
import numpy as np, sys
from collections import deque
def comps(path, erase=[]):
    im=Image.open(path).convert('RGBA'); A=np.array(im)
    for (x0,y0,x1,y1) in erase: A[y0:y1,x0:x1,3]=0
    # despill green
    r,g,b=A[...,0].astype(int),A[...,1].astype(int),A[...,2].astype(int)
    m=np.maximum(r,b); A[...,1]=np.where(g>m, m, g).astype('uint8')
    a=A[...,3]>60
    s=a[::3,::3].copy(); H,W=s.shape; lab=np.zeros((H,W),int); n=0; out=[]
    for y in range(H):
        for x in range(W):
            if s[y,x] and not lab[y,x]:
                n+=1; q=deque([(y,x)]); lab[y,x]=n; pts=[]
                while q:
                    cy,cx=q.popleft(); pts.append((cy,cx))
                    for dy in (-1,0,1):
                        for dx in (-1,0,1):
                            ny,nx=cy+dy,cx+dx
                            if 0<=ny<H and 0<=nx<W and s[ny,nx] and not lab[ny,nx]: lab[ny,nx]=n; q.append((ny,nx))
                if len(pts)>150:
                    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
                    out.append((n,min(xs)*3,min(ys)*3,max(xs)*3+3,max(ys)*3+3,len(pts)))
    return A,lab,out
if __name__=='__main__':
    A,lab,out=comps(sys.argv[1]); 
    for o in sorted(out,key=lambda o:(o[2]//200,o[1])): print(o)
