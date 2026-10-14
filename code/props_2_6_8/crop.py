import sys
from PIL import Image
# crop.py out x0 y0 x1 y1 (world px, canvas 384x224 -> 3x) files...
out=sys.argv[1]; x0,y0,x1,y1=[int(v)*3 for v in sys.argv[2:6]]; fs=sys.argv[6:]
ims=[Image.open(f).convert('RGB').crop((x0,y0,x1,y1)) for f in fs]
W=sum(i.width+6 for i in ims); o=Image.new('RGB',(W,ims[0].height),(255,0,255)); x=0
for i in ims: o.paste(i,(x,0)); x+=i.width+6
o.save(out)
