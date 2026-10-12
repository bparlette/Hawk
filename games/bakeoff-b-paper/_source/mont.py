import sys
from PIL import Image
out=sys.argv[1]; ims=[Image.open(p) for p in sys.argv[2:]]
crop=[i.crop((400,0,1290,516)) if i.width==1688 else i for i in ims]
w=max(c.width for c in crop); h=sum(c.height for c in crop)
m=Image.new('RGB',(w,h)); y=0
for c in crop: m.paste(c,(0,y)); y+=c.height
m.thumbnail((1000,1800)); m.save(out)
