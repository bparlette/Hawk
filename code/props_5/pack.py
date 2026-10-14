# cut, de-fringe, scale and pack the L5 stage props -> level5_props.png + level5_holds.jpg + meta.json
import numpy as np, json
from PIL import Image, ImageEnhance
def load(n): return Image.open(f'l5p_{n}.png').convert('RGBA')
def defringe(im):
    a=np.array(im).astype(np.int16); r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
    spill=(g>r+8)&(g>b+8)
    # semi-transparent green halo -> drop; opaque spill -> clamp green to max(r,b)
    a[...,3]=np.where(spill&(al<250),0,al)
    a[...,1]=np.where(spill,np.maximum(r,b),g)
    a[...,3]=np.where(a[...,3]<28,0,a[...,3])
    return Image.fromarray(a.clip(0,255).astype(np.uint8))
def dehalo(im):
    a=np.array(im).astype(np.int16); r,g,b=a[...,0],a[...,1],a[...,2]
    halo=((g>r*0.85)&(b<60)&(g>70)&((g-b)>50))|((b<55)&(g>85)&(g-b>55)&(r>140))
    a[...,3]=np.where(halo,0,a[...,3])
    from scipy import ndimage
    m=ndimage.binary_erosion(a[...,3]>0,iterations=2); a[...,3]=np.where(m,a[...,3],0)
    return defringe(Image.fromarray(a.clip(0,255).astype(np.uint8)))
def fit(im,w): h=round(im.height*w/im.width); return im.resize((w,h),Image.LANCZOS)
F={}
fl=defringe(load('forklift').crop((1649,10,1649+659,416)))
pr=load('props'); hook=defringe(pr.crop((85,165,295,743))); crate=defringe(pr.crop((400,318,779,694))); klax=dehalo(pr.crop((878,344,1062,606)))
sh=defringe(load('shutter').crop((0,15,2928,352)))
# trim to alpha bbox
def trim(im): return im.crop(im.getchannel('A').point(lambda v:255 if v>20 else 0).getbbox())
fl,hook,crate,klax,sh=map(trim,(fl,hook,crate,klax,sh))
src={'fork':fl.size,'hook':hook.size}
fl=fit(fl,328); hook=fit(hook,60); crate=fit(crate,100); klax=fit(klax,48); sh=fit(sh,420)
# unlit klaxon: dim + desaturate the dome
ka=np.array(klax).astype(float); lum=ka[...,:3].mean(-1,keepdims=True)
dim=ka.copy(); dim[...,:3]=(0.55*ka[...,:3]+0.45*lum)*0.55
klaxOff=Image.fromarray(dim.clip(0,255).astype(np.uint8))
parts=[('fork',fl),('hook',hook),('crate',crate),('klax',klax),('klaxOff',klaxOff),('shutter',sh)]
W=max(328+4+60+4+100+4+48+4+48, 420); 
x=y=0; rowh=0; place={}
for n,im in parts:
    if x+im.width>W: x=0; y+=rowh+4; rowh=0
    place[n]=[x,y,im.width,im.height]; x+=im.width+4; rowh=max(rowh,im.height)
H=y+rowh
sheet=Image.new('RGBA',(W,H),(0,0,0,0))
for n,im in parts: sheet.paste(im,tuple(place[n][:2]))
sheet.save('level5_props_rgba.png')
q=sheet.quantize(256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG)
q.save('level5_props.png',optimize=True)
# interiors (crop inside the generated door frames), one jpg
d=Image.open('l5p_interior_dock.png').convert('RGB').crop((380,46,1100,683)).resize((300,290),Image.LANCZOS)
s=Image.open('l5p_interior_ship.png').convert('RGB').crop((420,40,1060,600)).resize((220,200),Image.LANCZOS)
hj=Image.new('RGB',(524,290)); hj.paste(d,(0,0)); hj.paste(s,(304,0)); hj.save('level5_holds.jpg',quality=86,optimize=True)
place['holdDock']=[0,0,300,290]; place['holdShip']=[304,0,220,200]
json.dump({'frames':place,'src':src},open('meta.json','w'),indent=1)
print(place, sheet.size)
