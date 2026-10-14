from PIL import Image
import numpy as np, json
from split import comps
SC=0.58
def pack(path, erase, order, centers, out):
    A,lab,cs=comps(path, erase)
    byid={}
    for i,(pt) in enumerate(order[1]):
        byid[i]=max([c for c in cs if c[1]<=pt[0]<=c[3] and c[2]<=pt[1]<=c[4]], key=lambda c:c[5])
    frames=[]; x=0; tiles=[]
    for i,(name,cx) in enumerate(zip(order[0],centers)):
        cid,x0,y0,x1,y1,_=byid[i]
        L=np.kron(lab==cid, np.ones((3,3),bool))[:A.shape[0],:A.shape[1]]
        # dilate label mask a bit to keep antialiased edges
        Lp=np.pad(L,6); M=np.zeros_like(L)
        for dy in range(-6,7,3):
            for dx in range(-6,7,3): M|=Lp[6+dy:6+dy+L.shape[0],6+dx:6+dx+L.shape[1]]
        B=A.copy(); B[...,3]=np.where(M,B[...,3],0)
        x0=max(0,x0-6);y0=max(0,y0-6);x1=min(A.shape[1],x1+6);y1=min(A.shape[0],y1+6)
        im=Image.fromarray(B[y0:y1,x0:x1]); bb=im.getbbox(); im=im.crop(bb); ox=x0+bb[0]
        im=im.resize((round(im.size[0]*SC),round(im.size[1]*SC)),Image.LANCZOS)
        tiles.append((name,im,(cx-ox)*SC))
    H=max(t[1].size[1] for t in tiles); W=sum(t[1].size[0]+2 for t in tiles)
    sheet=Image.new('RGBA',(W,H),(0,0,0,0)); x=0; F={}
    for name,im,ax in tiles:
        y=H-im.size[1]; sheet.paste(im,(x,y)); F[name]=[x,y,im.size[0],im.size[1],round(ax)]; x+=im.size[0]+2
    sheet=sheet.quantize(colors=200,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG) if False else sheet
    sheet.save(out,optimize=True); print(out,sheet.size,json.dumps(F))
pack('lvl13_traag_raw.png',[(1100,250,1290,345)],(['idle','walk','fire','hurt','down'],[(175,250),(500,250),(845,250),(335,600),(885,700)]),[175,500,845,335,885],'level13_traag.png')
pack('lvl13_granitor_raw.png',[],(['idle','walk','leap','hurt','down'],[(160,500),(440,500),(700,300),(945,500),(1185,700)]),[160,440,700,945,1185],'level13_granitor.png')
