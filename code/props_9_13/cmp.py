import sys
from PIL import Image
N=sys.argv[1]
for s in sys.argv[2:]:
  a=Image.open(f'shots/{N}_before_{s}.png'); b=Image.open(f'shots/{N}_after_{s}.png')
  m=Image.new('RGB',(a.width*2+6,a.height),(255,255,255)); m.paste(a,(0,0)); m.paste(b,(a.width+6,0)); m=m.resize((m.width//2,m.height//2)); m.save(f'view/c{N}_{s}.jpg',quality=85)
