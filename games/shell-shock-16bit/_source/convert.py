# Auto 16-bit conversion, in place at original size so every atlas coordinate stays valid:
# Lanczos down to on-screen scale, 16 colours (31 for backgrounds), snap to Genesis 9-bit colour, nearest back up.
import glob, os, sys, numpy as np
from PIL import Image
from multiprocessing import Pool
os.chdir('/workspace/work/g16js/site')
SKIP={'cabinet_nostick.png','cabinet_special.png','icon180.png','icon192.png','icon512.png','stick.png'}
def g9(a): return (np.round(np.asarray(a,dtype=np.float32)/255*7)*255/7).astype(np.uint8)
def k_for(f,im):
    b=os.path.basename(f); w,h=im.size
    if b in ('title_bg.jpg','map_bg.jpg'): return 1/3, 31
    if b=='title_logo.png': return 172/516, 16
    if f.endswith('.jpg'): return 224/512, 31
    return 0.41, 16
def conv(f):
    b=os.path.basename(f)
    if b in SKIP: return f,'skip'
    im=Image.open(f); k,nc=k_for(f,im); W,H=im.size
    w,h=max(1,round(W*k)),max(1,round(H*k))
    if f.endswith('.jpg'):
        s=im.convert('RGB').resize((w,h),Image.LANCZOS)
        q=s.quantize(nc,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE).convert('RGB')
        out=Image.fromarray(g9(np.array(q))).resize((W,H),Image.NEAREST)
        out.save(f,quality=92,subsampling=0); return f,(w,h)
    s=im.convert('RGBA').resize((w,h),Image.LANCZOS); a=np.array(s)[:,:,3]>110
    if not a.any(): return f,'empty'
    rgb=Image.new('RGB',s.size); rgb.paste(s.convert('RGB'),mask=Image.fromarray((a*255).astype(np.uint8)))
    # quantize only opaque pixels
    px=np.array(rgb)[a].reshape(1,-1,3); qi=Image.fromarray(px).quantize(nc,method=Image.FASTOCTREE,kmeans=4,dither=Image.NONE).convert('RGB')
    o=np.zeros((h,w,4),np.uint8); o[a,:3]=g9(np.array(qi).reshape(-1,3)); o[a,3]=255
    Image.fromarray(o).resize((W,H),Image.NEAREST).save(f,optimize=True); return f,(w,h)
files=sorted(glob.glob('*.png')+glob.glob('*.jpg')+glob.glob('levels/*.png')+glob.glob('levels/*.jpg'))
with Pool(8) as p:
    for f,r in p.imap_unordered(conv,files): pass
print('converted',len(files))
