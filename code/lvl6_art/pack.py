from PIL import Image; import numpy as np, json, os
from scipy import ndimage as ndi
from seg import load, comps
IDLE_H=172   # stored idle height -> drawn at CF_K=0.5 = 86 world px
S={'A':load('cf_sheetA_k.png'),'B':load('cf_sheetB2_k.png'),'C':load('cf_sheetC_k.png')}
L={k:comps(v) for k,v in S.items()}
def find(s,x,y):
    lab,cs=L[s]
    for c in cs:
        if c[2]<=x<c[4] and c[3]<=y<c[5]: return c
    raise Exception((s,x,y))
def frame(s,x,y):
    a=S[s]; lab,cs=L[s]; c=find(s,x,y)
    m=lab==c[0]
    # attach small fragments inside bbox
    x0,y0,x1,y1=c[2],c[3],c[4],c[5]
    small=(a[...,3]>40)&~m; sl=np.zeros_like(m); sl[y0:y1,x0:x1]=True
    m=m|(small&sl&(ndi.binary_dilation(m,iterations=6)))
    ys,xs=np.nonzero(m); X0,X1,Y0,Y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sub=a[Y0:Y1,X0:X1].astype(np.float32).copy(); mm=m[Y0:Y1,X0:X1]
    al=np.where(mm,sub[...,3],0)
    al=np.minimum(al,ndi.grey_erosion(al,size=(3,3))*0.5+al*0.5)
    r,g,b=sub[...,0],sub[...,1],sub[...,2]; mx=np.maximum(r,b)
    g=np.where(g>mx,mx+(g-mx)*0.15,g)
    return np.dstack([r,g,b,al]).clip(0,255).astype(np.uint8)
spec=[('idle','A',100,200),('walk1','A',500,200),('walk2','A',850,200),('aim','A',1300,200),('throw','A',1850,200),
      ('kwind','B',100,200),('kick','B',400,200),('leap','B',900,200),('shout','B',1200,200),
      ('spin','B',150,600),('crouch','B',550,600),('hurt','B',850,600),('down','B',1150,700)]
kA=IDLE_H/frame('A',100,200).shape[0]
kB=kA*496/359.0          # B2 shout (upright, valve-to-skate) == A idle height
K={'A':kA,'B':kB}
imgs=[]
for n,s,x,y in spec:
    f=Image.fromarray(frame(s,x,y)); k=K[s]
    imgs.append((n,f.resize((max(1,round(f.width*k)),max(1,round(f.height*k))),Image.LANCZOS)))
# projectiles
def proj(x,y,h,soft=False):
    f=frame('C',x,y); im=Image.fromarray(f)
    im=im.resize((round(im.width*h/im.height),h),Image.LANCZOS)
    if soft:
        a=np.array(im).astype(np.float32); H,W=a.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
        d=np.hypot((xx-W/2)/(W/2),(yy-H/2)/(H/2)); a[...,3]*=np.clip((1.05-d)/0.5,0,1)*0.85
        r,g,b=a[...,0],a[...,1],a[...,2]; a[...,1]=np.minimum(g,(r+b)/2+12)
        im=Image.fromarray(a.clip(0,255).astype(np.uint8))
    return im
imgs+= [('shard',proj(200,370,22)),('snowball',proj(700,380,22)),('puff',proj(1100,380,56,True))]
Wt=sum(i.width+4 for _,i in imgs); Ht=max(i.height for _,i in imgs)
sheet=Image.new('RGBA',(Wt,Ht),(0,0,0,0)); x=0; meta={}
for n,im in imgs:
    y=Ht-im.height; sheet.paste(im,(x,y)); A=np.asarray(im).astype(int)
    r,g,b,al=[A[...,i] for i in range(4)]; h,w=al.shape; yy=np.mgrid[0:h,0:w][0]
    navy=(al>150)&(b>r+12)&(r<70)&(g<80)&(yy>h*0.45)&(yy<h*0.66)
    ys,xs=np.nonzero(navy)
    if n in('down','shard','snowball','puff') or len(xs)<40: ax=w//2
    else: ax=int(np.median(xs))
    meta[n]=[x,y,w,h,ax]; x+=w+4
sheet.save('cf_rgba.png')
sheet.quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG).save('level6_coldfront.png',optimize=True)
json.dump(meta,open('meta.json','w')); print(sheet.size,os.path.getsize('level6_coldfront.png')); print(json.dumps(meta))
