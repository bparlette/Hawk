from PIL import Image, ImageDraw
import numpy as np, sys, os, json
from scipy import ndimage as ndi
def key_green(f):
    a=np.array(Image.open(f).convert('RGBA')).astype(np.float32); r,g,b=a[...,0],a[...,1],a[...,2]
    gd=g-np.maximum(r,b)
    al=np.clip(1-(gd-15)/45.0,0,1)
    al=np.where(gd>60,0,al)
    mx=np.maximum(r,b)
    a[...,1]=np.where(g>mx,mx+(g-mx)*0.1,g); a[...,3]=al*255
    return a
def comps(a,minpix=2500):
    m=a[...,3]>40; m=ndi.binary_opening(m,iterations=1)
    lab,n=ndi.label(m,structure=np.ones((3,3))); out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append([i,int(cnt),sl[1].start,sl[0].start,sl[1].stop,sl[0].stop])
    # merge small comps (weapons/stray bits) near a big comp? keep simple: order by center x
    H=a.shape[0]
    out.sort(key=lambda c:(0 if (c[3]+c[5])/2<H*0.5 else 1,(c[2]+c[4])/2))
    return lab,out
def preview(f,out):
    a=key_green(f); lab,cs=comps(a)
    im=Image.new('RGB',(a.shape[1],a.shape[0]),(60,60,70)); im.paste(Image.fromarray(a.astype(np.uint8),'RGBA'),(0,0),Image.fromarray(a.astype(np.uint8),'RGBA'))
    d=ImageDraw.Draw(im); from PIL import ImageFont; fnt=ImageFont.load_default(size=72)
    for j,c in enumerate(cs):
        d.rectangle(c[2:],outline=(255,0,0),width=3); d.text((c[2]+8,c[3]+4),str(j),fill=(255,255,0),font=fnt,stroke_width=3,stroke_fill=(0,0,0))
    im.thumbnail((1400,600)); im.save(out)
    return cs
if __name__=='__main__':
    for f in sys.argv[1:]:
        cs=preview(f,'view/p_'+os.path.basename(f).replace('.png','.jpg'))
        print(f,[(j,c[1],c[2:]) for j,c in enumerate(cs)])
