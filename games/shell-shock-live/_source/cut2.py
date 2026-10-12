import cv2, numpy as np, json
def key(im,t):
    bgr=im[...,:3]; d=(255-bgr.min(2)).astype(np.uint8)
    a=np.where(d>t,255,0).astype(np.uint8)
    a=cv2.morphologyEx(a,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    a=cv2.GaussianBlur(a,(3,3),0); return np.dstack([bgr,a])
def crop(im,x,y,w,h,pad=6,keepbig=True):
    c=im[max(0,y-pad):y+h+pad,max(0,x-pad):x+w+pad].copy()
    if keepbig:
        al=c[...,3]>40; k=cv2.dilate(al.astype(np.uint8),np.ones((9,9),np.uint8))
        n,lab,st,_=cv2.connectedComponentsWithStats(k); big=1+np.argmax(st[1:,4])
        c[...,3]=np.where(lab==big,c[...,3],0)
    ys,xs=np.where(c[...,3]>40); return c[ys.min():ys.max()+1,xs.min():xs.max()+1]
def atlas(name,crops,target,ref='idle'):
    s=target/crops[ref].shape[0]; fr=[(p,cv2.resize(c,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)) for p,c in crops.items()]
    H=max(r.shape[0] for _,r in fr); W=sum(r.shape[1]+2 for _,r in fr)
    A=np.zeros((H,W,4),np.uint8); m={}; x=0
    for p,r in fr:
        h,w=r.shape[:2]; A[H-h:H,x:x+w]=r; m[p]={'x':x,'y':H-h,'w':w,'h':h}; x+=w+2
    cv2.imwrite(f'atlas_{name}.png',A); print(name,A.shape); return m
meta=json.load(open('atlas.json'))
g=key(cv2.imread('live_gunner_sheet.png'),30)
G={'idle':(23,149,253,372),'walk':(280,116,220,411),'attack':(471,140,310,389),'jump':(714,62,339,287),'hurt':(930,167,240,361),'down':(1073,449,324,108)}
meta['gunner']=atlas('gunner',{p:crop(g,*b) for p,b in G.items()},150)
z=key(cv2.imread('live_zap_sheet.png'),40)
Z={'idle':(81,81,267,301),'roll':(567,77,269,304),'charge':(964,83,270,298),'ram':(851,424,262,303),'dying':(1116,436,252,290)}
meta['zap']=atlas('zap',{p:crop(z,*b,keepbig=False) for p,b in Z.items()},130)
json.dump(meta,open('atlas.json','w'))
# room
r=cv2.imread('live_room.png'); cv2.imwrite('room.jpg',r,[cv2.IMWRITE_JPEG_QUALITY,84])
# stairs: trim, resize width 900
s=cv2.imread('live_stairs.png',cv2.IMREAD_UNCHANGED); ys,xs=np.where(s[...,3]>40); s=s[ys.min():ys.max()+1,xs.min():xs.max()+1]
s=cv2.resize(s,(900,int(s.shape[0]*900/s.shape[1])),interpolation=cv2.INTER_AREA); cv2.imwrite('stairs.png',s); print('stairs',s.shape)
b=cv2.imread('live_ball.png',cv2.IMREAD_UNCHANGED); ys,xs=np.where(b[...,3]>40); b=b[ys.min():ys.max()+1,xs.min():xs.max()+1]
b=cv2.resize(b,(48,48),interpolation=cv2.INTER_AREA); cv2.imwrite('ball.png',b)
# preview
rows=[cv2.imread(f'atlas_{n}.png',cv2.IMREAD_UNCHANGED) for n in ['gunner','zap']]
Wm=max(r.shape[1] for r in rows); P=np.full((sum(r.shape[0] for r in rows),Wm,3),90,np.uint8); y=0
for r in rows:
    a=r[...,3:]/255.; sl=P[y:y+r.shape[0],:r.shape[1]]; P[y:y+r.shape[0],:r.shape[1]]=(r[...,:3]*a+sl*(1-a)).astype(np.uint8); y+=r.shape[0]
cv2.imwrite('preview2.jpg',P)
