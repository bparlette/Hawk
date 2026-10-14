import sys
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB').resize((576,336)) for f in fs]
o=Image.new('RGB',(1152,336*((len(ims)+1)//2))); [o.paste(im,((i%2)*576,(i//2)*336)) for i,im in enumerate(ims)]; o.save(out,quality=88)
