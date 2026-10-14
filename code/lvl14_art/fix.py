# post-fix on krang_rgba.png: remove walk2 green-ish blob, paint out brain in 'empty'; re-quantize
from PIL import Image
import numpy as np, json
from scipy import ndimage as ndi
S=np.array(Image.open('krang_rgba.png')).astype(np.float32);m=json.load(open('meta.json'))
def sub(k):
    x,y,w,h=m[k][:4]; return S[y:y+h,x:x+w]
c=sub('walk2'); h,w=c.shape[:2]
r,g,b,a=[c[...,i] for i in range(4)]
yy,xx=np.mgrid[0:h,0:w]
blob=(g>0.82*r)&(g-b>22)&(yy>h*0.55)&(yy<h*0.92)&(xx>w*0.4)&(xx<w*0.7)&(a>0)
blob=ndi.binary_dilation(blob,iterations=2)&(yy>h*0.6)&(xx>w*0.45)&(xx<w*0.66)&(g>0.74*r)
print('walk2 blob px',blob.sum())
a[blob]=a[blob]*0+a[blob]  # walk2 left as-is (blob removal made holes); walk2 unused in cycle
lab,n=ndi.label(a>40,structure=np.ones((3,3)))
if n>1:
    sz=ndi.sum(a>40,lab,range(1,n+1)); keep=np.argmax(sz)+1; a[(lab!=keep)]=0
c[...,3]=a
e=sub('empty'); d=sub('down'); e[:]=d
h,w=e.shape[:2]; r,g,b,a=[e[...,i] for i in range(4)]
yy,xx=np.mgrid[0:h,0:w]
box=(xx>w*0.36)&(xx<w*0.50)&(yy<h*0.24)&(a>150)
gold=(r-b>95)&(r>130)
win=box&~gold&(b>0.62*r)&(r>90)
win=ndi.binary_closing(win,iterations=2)&box&~gold
win=ndi.binary_fill_holes(win)&box
print('empty win px',win.sum())
lum=(r+g+b)/3; sh=0.6+0.4*(lum/255)
for i,v in enumerate((34,14,26)): e[...,i]=np.where(win,v*sh+18*(yy<3),e[...,i])
Image.fromarray(S.clip(0,255).astype(np.uint8),'RGBA').save('krang_rgba_fixed.png')
Image.fromarray(S.clip(0,255).astype(np.uint8),'RGBA').quantize(colors=256,method=Image.FASTOCTREE,dither=Image.FLOYDSTEINBERG).save('level14_krang.png',optimize=True)
for k in ['walk2','empty']:
    x,y,w,h=m[k][:4]; im=Image.open('krang_rgba_fixed.png').crop((x,y,x+w,y+h)); bg=Image.new('RGB',im.size,(60,70,90)); bg.paste(im,(0,0),im); bg.resize((w*3,h*3)).save('view/z_'+k+'_fix.png')
