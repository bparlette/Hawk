import sys,glob
from PIL import Image
pre,out=sys.argv[1],sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
fs=sorted(glob.glob(pre+'*.png'),key=lambda f:int(f[len(pre):-4]) if f[len(pre):-4].isdigit() else 999)
ims=[Image.open(f).convert('RGB') for f in fs]
# crop to game screen region roughly (center) 
w,h=ims[0].size; rows=(len(ims)+cols-1)//cols
m=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims): m.paste(im,((i%cols)*w,(i//cols)*h))
s=min(1,1800/m.width); m.resize((int(m.width*s),int(m.height*s))).save(out)
