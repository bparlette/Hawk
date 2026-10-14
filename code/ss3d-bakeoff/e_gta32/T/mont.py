from PIL import Image, ImageDraw
import glob, sys
fs=sorted(glob.glob('T/pose_*.png')); W,H=Image.open(fs[0]).size; cw,ch=W//3,H//3
names=['hero idle','hero idle back','hero run','c1 wind','c1 strike','c2 strike','c3 wind','c3 strike','jump','jump slash','cyclone','hurt','down','thug idle','thug walk','punch','kick','dash','e hurt','e down']
cols=5; rows=(len(fs)+cols-1)//cols; M=Image.new('RGB',(cols*cw, rows*ch))
for i,f in enumerate(fs):
  im=Image.open(f).resize((cw,ch)); d=ImageDraw.Draw(im); d.text((6,ch-14),names[i],fill=(255,255,0)); M.paste(im,((i%cols)*cw,(i//cols)*ch))
M.save('T/poses.png'); print(M.size)
