import cv2, numpy as np, json
B={
 'lenny':{'idle':(27,39,310,385),'walk':(327,42,529,386),'walk2':(285,404,553,738),'attack':(550,65,946,388),'jump':(1014,35,1391,341),'hurt':(790,377,1005,740),'down':(1015,610,1373,762)},
 'rafe':{'idle':(27,95,294,498),'walk':(295,94,589,498),'attack':(589,125,1036,498),'jump':(968,39,1401,415),'hurt':(305,496,595,765),'down':(590,630,915,765)},
 'miko':{'idle':(14,150,232,530),'walk':(241,150,464,530),'attack':(467,140,744,530),'jump':(767,45,945,380),'hurt':(948,160,1160,525),'down':(1074,420,1400,530)},
 'donny':{'idle':(15,200,335,525),'walk':(300,170,500,525),'attack':(500,215,808,525),'jump':(770,30,1040,410),'hurt':(965,225,1180,525),'down':(1075,425,1406,560)},
 'ninja':{'idle':(15,145,275,525),'walk':(262,110,472,530),'attack':(470,140,780,530),'jump':(712,60,1058,350),'hurt':(925,160,1170,530),'down':(1072,445,1402,545)},
}
TARGET=150
meta={}
for n,poses in B.items():
    im=cv2.imread(f'live_{n}_sheet.png',cv2.IMREAD_UNCHANGED)
    if im.shape[2]==3:
        bgr=im; d=(255-bgr.min(2)).astype(np.uint8)
        a=np.where(d>22,255,0).astype(np.uint8)
        a=cv2.morphologyEx(a,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        a=cv2.GaussianBlur(a,(3,3),0)
        im=np.dstack([bgr,a])
    crops={}
    for p,(x0,y0,x1,y1) in poses.items():
        c=im[y0:y1,x0:x1].copy()
        al=c[...,3]>40
        k=cv2.dilate(al.astype(np.uint8),np.ones((9,9),np.uint8))
        nl,lab,st,_=cv2.connectedComponentsWithStats(k)
        big=1+np.argmax(st[1:,4]); keep=(lab==big)
        c[...,3]=np.where(keep,c[...,3],0)
        ys,xs=np.where(c[...,3]>40); c=c[ys.min():ys.max()+1,xs.min():xs.max()+1]
        crops[p]=c
    s=TARGET/crops['idle'].shape[0]
    frames=[];x=0;H=0
    for p,c in crops.items():
        r=cv2.resize(c,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)
        if n=='ninja': r=cv2.flip(r,1)
        frames.append((p,r)); H=max(H,r.shape[0])
    W=sum(r.shape[1]+2 for _,r in frames)
    atlas=np.zeros((H,W,4),np.uint8); m={}
    for p,r in frames:
        h,w=r.shape[:2]; atlas[H-h:H,x:x+w]=r
        m[p]={'x':x,'y':H-h,'w':w,'h':h}; x+=w+2
    cv2.imwrite(f'atlas_{n}.png',atlas); meta[n]=m
    print(n,atlas.shape)
json.dump(meta,open('atlas.json','w'))
rows=[cv2.imread(f'atlas_{n}.png',cv2.IMREAD_UNCHANGED) for n in B]
Wm=max(r.shape[1] for r in rows); prev=np.full((sum(r.shape[0] for r in rows),Wm,3),90,np.uint8); y=0
for r in rows:
    a=r[...,3:]/255.; sl=prev[y:y+r.shape[0],:r.shape[1]]; prev[y:y+r.shape[0],:r.shape[1]]=(r[...,:3]*a+sl*(1-a)).astype(np.uint8); y+=r.shape[0]
cv2.imwrite('preview.jpg',prev)
