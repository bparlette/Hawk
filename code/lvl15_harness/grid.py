import sys
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).convert('RGB').resize((576,336)) for f in fs]
cols=2; rows=(len(ims)+1)//2
g=Image.new('RGB',(576*cols,336*rows))
for i,im in enumerate(ims): g.paste(im,((i%2)*576,(i//2)*336))
g.save(out)
