# generates duck/dog pixel maps -> g7spr.json + preview png
import json
from PIL import Image, ImageDraw
PAL={'.':(0,0,0),'b':(138,82,38),'l':(217,178,122),'g':(26,138,68),'w':(255,255,255),'o':(255,154,30),'O':(197,106,8),
     'd':(58,32,12),'f':(110,66,28),'F':(190,140,80),'k':(10,10,10),'W':(250,250,250),'r':(200,20,20),
     't':(224,160,92),'e':(106,60,20),'p':(232,80,106),'R':(160,24,48),'B':(184,116,44)}
INV={v:k for k,v in PAL.items()}
def new(w,h): return Image.new('RGB',(w,h),PAL['.'])
def c(ch): return PAL[ch]
def rows(im):
    w,h=im.size; px=im.load(); out=[]
    for y in range(h): out.append(''.join(INV[px[x,y]] for x in range(w)))
    return out
def duck(wing, dead=False):
    im=new(30,24); d=ImageDraw.Draw(im)
    # tail
    d.polygon([(0,13),(6,11),(8,17),(2,18)],fill=c('d'))
    d.polygon([(1,14),(5,13),(6,16),(2,16)],fill=c('f'))
    # body
    d.ellipse([3,10,22,20],fill=c('b'))
    d.pieslice([5,12,21,21],0,180,fill=c('l'))
    d.ellipse([6,10,16,14],fill=c('B'))
    # neck + head
    d.rectangle([20,10,24,15],fill=c('g'))
    d.ellipse([19,3,27,12],fill=c('g'))
    d.rectangle([19,14,25,15],fill=c('w'))
    # bill
    d.rectangle([26,7,29,9],fill=c('o')); d.rectangle([26,10,28,10],fill=c('O')); d.point((29,8),fill=c('o'))
    # eye
    if dead:
        d.point((23,6),fill=c('w')); d.point((24,7),fill=c('w')); d.point((24,6),fill=c('w')); d.point((23,7),fill=c('w'))
        d.line([(23,6),(24,7)],fill=c('r')); d.line([(24,6),(23,7)],fill=c('r'))
    else:
        d.rectangle([23,6,24,7],fill=c('W')); d.point((24,7),fill=c('k')); d.point((24,6),fill=c('k')) if False else None
        d.point((24,7),fill=c('k'))
    # wing
    if wing=='up':
        d.polygon([(8,12),(3,1),(9,0),(16,6),(17,12)],fill=c('f'))
        d.polygon([(8,11),(5,3),(9,2),(14,7)],fill=c('F'))
    elif wing=='mid':
        d.polygon([(16,12),(1,9),(0,12),(12,16)],fill=c('f'))
        d.polygon([(15,12),(4,10),(3,11),(11,14)],fill=c('F'))
    else:
        d.polygon([(7,15),(5,23),(12,23),(18,15)],fill=c('f'))
        d.polygon([(8,16),(7,22),(11,22),(15,16)],fill=c('F'))
    return im
def hang():
    # duck held by the dog: wings spread, head drooping
    im=new(26,16); d=ImageDraw.Draw(im)
    d.polygon([(0,3),(8,5),(8,11),(2,9)],fill=c('f')); d.polygon([(25,3),(17,5),(17,11),(23,9)],fill=c('f'))
    d.polygon([(1,4),(7,6),(7,8),(2,7)],fill=c('F')); d.polygon([(24,4),(18,6),(18,8),(23,7)],fill=c('F'))
    d.ellipse([7,3,18,12],fill=c('b')); d.pieslice([8,6,17,13],0,180,fill=c('l'))
    d.rectangle([11,10,14,13],fill=c('g')); d.ellipse([9,11,16,15],fill=c('g'))
    d.rectangle([10,13,15,13],fill=c('o'))
    d.point((11,12),fill=c('r')); d.point((14,12),fill=c('r'))
    return im
def dog(mode):
    im=new(36,32); d=ImageDraw.Draw(im)
    # ears
    d.ellipse([2,6,10,24],fill=c('e')); d.ellipse([26,6,34,24],fill=c('e'))
    # shoulders
    d.ellipse([3,22,33,40],fill=c('B'))
    # head
    d.ellipse([8,2,28,24],fill=c('B'))
    d.ellipse([10,3,26,10],fill=c('t')) if False else None
    # muzzle
    d.ellipse([11,12,25,25],fill=c('t'))
    d.ellipse([15,12,21,16],fill=c('k'))
    if mode=='laugh0' or mode=='laugh1':
        # closed laughing eyes
        d.line([(11,8),(13,6),(15,8)],fill=c('k')); d.line([(21,8),(23,6),(25,8)],fill=c('k'))
        o=1 if mode=='laugh1' else 0
        d.ellipse([13,17,23,24+o],fill=c('R'))
        d.rectangle([14,17,22,18],fill=c('w'))
        d.ellipse([15,21,21,25+o],fill=c('p'))
        d.rectangle([14,16,22,16],fill=c('t'))
    else:
        d.rectangle([11,6,14,9],fill=c('W')); d.rectangle([22,6,25,9],fill=c('W'))
        d.rectangle([13,7,14,9],fill=c('k')); d.rectangle([22,7,23,9],fill=c('k'))
        d.line([(14,20),(18,22),(22,20)],fill=c('k'))
        d.rectangle([16,22,20,23],fill=c('p'))
    return im
S={}
S['duck']={'up':rows(duck('up')),'mid':rows(duck('mid')),'down':rows(duck('down')),'dead':rows(duck('mid',True))}
S['hang']=rows(hang())
S['dog']={'laugh0':rows(dog('laugh0')),'laugh1':rows(dog('laugh1')),'hit':rows(dog('hit'))}
json.dump(S,open('g7spr.json','w'))
# preview
pv=Image.new('RGB',(30*4+26+36*3+40,60),(60,140,200))
x=2
for k in ['up','mid','down','dead']:
    pv.paste(Image.eval(Image.new('RGB',(1,1)),lambda v:v),(0,0)) if False else None
def paste(im,x,y):
    px=im.load(); w,h=im.size
    for yy in range(h):
        for xx in range(w):
            if px[xx,yy]!=(0,0,0): pv.putpixel((x+xx,y+yy),px[xx,yy])
for k in ['up','mid','down','dead']:
    paste(duck(k if k!='dead' else 'mid',k=='dead'),x,2); x+=31
paste(hang(),x,2); x+=28
for m in ['laugh0','laugh1','hit']:
    paste(dog(m),x,2); x+=37
pv=pv.resize((pv.width*5,pv.height*5),Image.NEAREST); pv.save('g7raw.png')
