import sys,glob
from PIL import Image, ImageDraw
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f).convert('RGB').resize((195,422)) for f in fs]
W=7;Hn=(len(ims)+W-1)//W
s=Image.new('RGB',(195*W,436*Hn),(40,40,40)); d=ImageDraw.Draw(s)
for i,(im,f) in enumerate(zip(ims,fs)):
    x,y=(i%W)*195,(i//W)*436; s.paste(im,(x,y+14)); d.text((x+3,y+1),f.split('/')[-1][:30],fill=(255,255,0))
s.save(out)
