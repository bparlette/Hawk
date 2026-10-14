import sys, os, glob
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
KEEP={'icon180.png','icon192.png','icon512.png'}
def conv(args):
    p, exact = args
    im=Image.open(p); im.load()
    src=im.convert('RGBA')
    out=p[:-4]+'.webp'
    if not (os.path.exists(out) and os.path.getmtime(out)>=os.path.getmtime(p)):
        src.save(out+'.tmp','WEBP',lossless=True,quality=100,method=6,exact=exact); os.replace(out+'.tmp',out)
    d=Image.open(out); d.load(); d=d.convert('RGBA')
    if exact: ok = d.tobytes()==src.tobytes()
    else:
        # compare alpha everywhere and RGB where alpha>0
        import numpy as np
        a=np.asarray(src); b=np.asarray(d); m=a[...,3]>0
        ok = (a[...,3]==b[...,3]).all() and (a[m]==b[m]).all()
    return p, os.path.getsize(p), os.path.getsize(out), ok, im.mode
if __name__=='__main__':
    root=sys.argv[1]; exact=sys.argv[2]=='exact'
    ps=[p for p in glob.glob(root+'/*.png')+glob.glob(root+'/levels/*.png') if os.path.basename(p) not in KEEP]
    tb=ta=0; bad=[]
    with ProcessPoolExecutor(2) as ex:
        for p,b,a,ok,mode in ex.map(conv,[(p,exact) for p in ps]):
            tb+=b; ta+=a
            if not ok: bad.append(p)
            print(f"{os.path.relpath(p,root)}\t{mode}\t{b}\t{a}\t{'OK' if ok else 'MISMATCH'}")
    print(f"TOTAL {len(ps)} files: png {tb} -> webp {ta} ({100*(1-ta/tb):.1f}% smaller); mismatches: {bad}")
