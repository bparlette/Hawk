from PIL import Image; import numpy as np; from scipy import ndimage as ndi
def load(n): return np.array(Image.open(n).convert('RGBA'))
def comps(a,minpix=1500):
    m=a[...,3]>40; lab,n=ndi.label(m,structure=np.ones((3,3))); out=[]
    for i,sl in enumerate(ndi.find_objects(lab),1):
        cnt=(lab[sl]==i).sum()
        if cnt>=minpix: out.append((i,int(cnt),sl[1].start,sl[0].start,sl[1].stop,sl[0].stop))
    return lab,out
if __name__=='__main__':
    for s in ['cf_sheetA_k.png','cf_sheetB2_k.png','cf_sheetC_k.png']:
        a=load(s); lab,cs=comps(a); print(s,a.shape); [print('  ',c[1:]) for c in cs]
