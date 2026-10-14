import sys
from PIL import Image
# mont.py out.png scale img...
out=sys.argv[1]; sc=float(sys.argv[2]); ims=[Image.open(f).convert('RGB') for f in sys.argv[3:]]
ims=[i.resize((int(i.width*sc),int(i.height*sc))) for i in ims]
W=sum(i.width for i in ims)+4*(len(ims)-1);H=max(i.height for i in ims)
o=Image.new('RGB',(W,H),(255,255,255));x=0
for i in ims:o.paste(i,(x,0));x+=i.width+4
o.save(out)
