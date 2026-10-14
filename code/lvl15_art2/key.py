from PIL import Image
import numpy as np
from scipy import ndimage as ndi
def key_white(f,out):
    a=np.array(Image.open(f).convert('RGBA')).astype(np.float32); rgb=a[...,:3]
    mn=rgb.min(-1); mx=rgb.max(-1)
    cand=((mn>232)&((mx-mn)<16))|(a[...,3]<10)
    lab,n=ndi.label(cand); border=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(border))
    c2=(mn>238)&((mx-mn)<12); l2,n2=ndi.label(c2); sz=np.bincount(l2.ravel()); big=np.nonzero(sz>120)[0]; big=big[big>0]
    bg|=np.isin(l2,big); fg=~bg
    fg=ndi.binary_opening(fg,iterations=1)
    dist=ndi.distance_transform_edt(fg)
    whit=np.clip((255-mn)/50.0,0,1)
    al=np.where(dist<=2,whit,1.0)*fg
    A=al[...,None]; rgb2=np.where(A>0.02,(rgb-(1-A)*255)/np.maximum(A,1e-3),0)
    a[...,:3]=np.clip(rgb2,0,255); a[...,3]=al*255
    Image.fromarray(a.astype(np.uint8)).save(out)
def key_green(f,out):
    a=np.array(Image.open(f).convert('RGBA')).astype(np.float32); r,g,b=a[...,0],a[...,1],a[...,2]
    gd=g-np.maximum(r,b)
    al=np.clip(1-(gd-15)/45.0,0,1)
    fg=al>0.5; lab,n=ndi.label(fg,structure=np.ones((3,3)))
    al=np.where(gd>60,0,al)
    g2=np.where(g>np.maximum(r,b),np.maximum(r,b)+(g-np.maximum(r,b))*0.1,g)
    a[...,1]=g2; a[...,3]=al*255*(a[...,3]/255)
    Image.fromarray(a.clip(0,255).astype(np.uint8)).save(out)
key_white('l15b_elite.png','k_elite.png')
key_green('l15b_shred_fall.png','k_shred_fall.png')
for f in ['l15b_elite2.png','l15b_super_new.png','l15b_shred_new.png']:
    key_green(f,'k_'+f[5:])
