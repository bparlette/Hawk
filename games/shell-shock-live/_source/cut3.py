import cv2, numpy as np, json
exec(open('cut2.py').read().split('meta=json.load')[0])
meta=json.load(open('atlas.json'))
r=key(cv2.imread('live_ramrod_sheet.png'),30)
R={'idle':(36,19,226,365),'walk':(305,25,245,358),'charge':(584,64,310,319),'kick':(1077,26,294,357),'fire':(245,392,300,351),'hurt':(606,402,253,340),'down':(1012,621,373,125)}
cr={p:crop(r,*b,keepbig=(p!='fire')) for p,b in R.items()}
meta['ramrod']=atlas('ramrod',cr,190)
a=key(cv2.imread('live_amber_razor_sheet.png'),30)
A={'tied':(23,271,210,447),'shout':(267,271,192,447),'free':(462,220,206,494)}
meta['amber']=atlas('amber',{p:crop(a,*b) for p,b in A.items()},150,ref='free')
Z={'stand':(677,181,265,536),'lunge':(891,236,333,478),'leap':(1045,11,346,501)}
meta['razor']=atlas('razor',{p:crop(a,*b) for p,b in Z.items()},170,ref='stand')
json.dump(meta,open('atlas.json','w'))
d=cv2.imread('live_drill.png',cv2.IMREAD_UNCHANGED).astype(np.int32)
b,g,rr,al=d[...,0],d[...,1],d[...,2],d[...,3]
green=(g>rr+25)&(g>b+25); al=np.where(green,0,al)
light=(d[...,:3].min(2)>200); al=np.where(light,0,al)
g2=np.minimum(g,np.maximum(rr,b)); d[...,1]=g2; d[...,3]=al
d=d.astype(np.uint8); m=(d[...,3]>60).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
n,lab,st,_=cv2.connectedComponentsWithStats(cv2.dilate(m,np.ones((15,15),np.uint8))); big=1+np.argmax(st[1:,4])
d[...,3]=np.where((lab==big)&(m>0),d[...,3],0)
ys,xs=np.where(d[...,3]>60); d=d[ys.min():ys.max()+1,xs.min():xs.max()+1]
d=cv2.resize(d,(420,int(d.shape[0]*420/d.shape[1])),interpolation=cv2.INTER_AREA); cv2.imwrite('drill.png',d); print('drill',d.shape)
rows=[cv2.imread(f'atlas_{n}.png',cv2.IMREAD_UNCHANGED) for n in ['ramrod','amber','razor']]+[d]
Wm=max(r.shape[1] for r in rows); P=np.full((sum(r.shape[0] for r in rows),Wm,3),90,np.uint8); y=0
for q in rows:
    al=q[...,3:]/255.; sl=P[y:y+q.shape[0],:q.shape[1]]; P[y:y+q.shape[0],:q.shape[1]]=(q[...,:3]*al+sl*(1-al)).astype(np.uint8); y+=q.shape[0]
cv2.imwrite('preview3.jpg',P)
