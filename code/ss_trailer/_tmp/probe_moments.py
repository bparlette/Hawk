import sys,os,json
sys.argv=['x']
from build import *
from PIL import Image
L=MOMENT_BEATS*BEAT
res={}
sheet=Image.new("RGB",(4*288,15*168))
for d in sorted([d for d in os.listdir(RAW) if d.startswith('level')],key=lambda s:int(s[5:])):
    c=Cap(d);m=find_moments(c);st,k=best_moment(c,m);n=int(d[5:])
    res[n]=(st,k);print(n,st,k,len(c))
    for j,off in enumerate([0,L//3,2*L//3,L-1]):
        im=Image.open(os.path.join(c.dir,'frames',c.meta[min(len(c)-1,st+off)]['file'])).resize((288,168))
        sheet.paste(im,(j*288,(n-1)*168))
sheet.save('_tmp/probe_raw_moments.jpg',quality=80)
json.dump(res,open('_tmp/moments.json','w'))
