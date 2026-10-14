# re-key sheets whose top band kept a pale green gradient: flood from transparent/border through greenish pixels
from PIL import Image; import numpy as np; from scipy import ndimage as ndi; import sys
src,dst=sys.argv[1],sys.argv[2]
a=np.array(Image.open(src).convert('RGBA')).astype(np.int32)
r,g,b,al=[a[...,i] for i in range(4)]
gex=g-np.maximum(r,b)
cand=(al<40)|((gex>=5)&(g>150))
lab,n=ndi.label(cand)
seeds=set(np.unique(lab[al<40]))|set(np.unique(np.concatenate([lab[0],lab[:,0],lab[:,-1]])))
seeds.discard(0)
bg=np.isin(lab,list(seeds))
fg=~bg
# soft edge: pixels touching bg with green excess get partial alpha
edge=fg&ndi.binary_dilation(bg,iterations=2)
newa=np.where(bg,0,al)
newa=np.where(edge&(gex>0),np.clip(al-gex*6,0,255),newa)
# despill
mx=np.maximum(r,b); g2=np.where(g>mx,mx+(g-mx)*0.2,g)
a[...,1]=g2; a[...,3]=newa
Image.fromarray(a.clip(0,255).astype(np.uint8)).save(dst)
bgv=Image.new('RGB',(a.shape[1],a.shape[0]),(60,70,90)); im=Image.open(dst); bgv.paste(im,(0,0),im); bgv.thumbnail((1400,700)); bgv.save('view/keyed_'+dst.split('/')[-1])
print('done',bg.mean())
