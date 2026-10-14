from PIL import Image
import numpy as np
im=np.array(Image.open('gen_l9_edo.png').convert('RGB')).astype(np.float32)
a,b,w=150,1890,110   # crop [a,b), blend last w cols with first w
seg=im[:,a:b].copy()
L=seg.shape[1]
k=np.linspace(0,1,w)[None,:,None]
seg[:,L-w:]=seg[:,L-w:]*(1-k)+seg[:,:w]*k
out=seg[:,w:]
o=Image.fromarray(out.clip(0,255).astype(np.uint8))
print(o.size)
o.save('level9_edo.jpg',quality=85)
# tiled check
t=Image.new('RGB',(o.width*2,512)); t.paste(o,(0,0)); t.paste(o,(o.width,0)); t.crop((o.width-500,0,o.width+500,512)).save('seam_check.jpg')
# boss arena
bi=Image.open('gen_l9_boss.png').convert('RGB'); s=512/bi.height
bi=bi.resize((round(bi.width*s),512),Image.LANCZOS); x0=(bi.width-878)//2
bi.crop((x0,0,x0+878,512)).save('level9_castle.jpg',quality=86)
print(bi.size)
