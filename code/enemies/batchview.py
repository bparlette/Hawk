import sys
from PIL import Image
from tools import preview
fs=sys.argv[2:]; ims=[]
for f in fs:
    cs=preview('gen/%s.png'%f,'view/p_%s.jpg'%f); print(f,len(cs)); ims.append(Image.open('view/p_%s.jpg'%f))
W=max(i.width for i in ims); H=sum(i.height for i in ims)
o=Image.new('RGB',(W,H)); y=0
for i in ims: o.paste(i,(0,y)); y+=i.height
o.thumbnail((1400,2100)); o.save('view/%s.jpg'%sys.argv[1],quality=85)
