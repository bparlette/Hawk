import sys, struct, random
sys.path.insert(0,'/workspace/work/g16/test'); from lr import Emu
ROM=sys.argv[1]; SYM={l.split()[2]:int(l.split()[0],16)&0xFFFF for l in open('/workspace/work/g16/rom/out/symbol.txt') if len(l.split())==3}
e=Emu(ROM); OUT='/workspace/work/g16/test/'
def r16(m,a): return struct.unpack('<h',m[a:a+2])[0]
def rb(m,a): return m[a^1]
def st():
    m=e.ram(); P=SYM['P']; E=SYM['E']
    p=dict(x=r16(m,P+8),y=r16(m,P+10),hp=r16(m,P+20))
    es=[]
    for i in range(4):
        b=E+i*36
        if rb(m,b+4): es.append(dict(type=rb(m,b+5),state=rb(m,b+6),x=r16(m,b+8),y=r16(m,b+10),hp=r16(m,b+20)))
    return p,es,rb(m,[v for k,v in SYM.items() if k.startswith('phase')][0]),r16(m,SYM['camX']),r16(m,SYM['lives'])
e.run(150); e.shot(OUT+'r_title.png')
e.tap('start',6); e.run(90); e.shot(OUT+'r_start.png')
shots={300:'r_wave1',900:'r_wave2',1500:'r_wave3',2800:'r_boss1',3300:'r_boss2',3800:'r_boss3'}; log=[]; lastph=None; f=0; random.seed(1)
while f<9000:
    p,es,ph,cam,lv=st()
    if ph!=lastph: log.append((f,'phase',ph,'lives',lv,'hp',p['hp'])); lastph=ph; e.shot(OUT+f'r_phase{ph}.png')
    if ph>=3: e.run(30); e.shot(OUT+f'r_end{ph}.png'); break
    hold=[]
    if es:
        t=min(es,key=lambda q:abs(q['x']-p['x'])+abs(q['y']-p['y'])*2)
        dx=t['x']-p['x']; dy=t['y']-p['y']
        if abs(dy)>3: hold.append('down' if dy>0 else 'up')
        if abs(dx)>34: hold.append('right' if dx>0 else 'left')
        elif abs(dx)<18: hold.append('left' if dx>0 else 'right')
        if abs(dx)<44 and abs(dy)<8:
            hold+= ['right' if dx>0 else 'left']
            if f%8<3: hold.append('b')
            if f%300==150: hold=['a']
            if f%200==100: hold=['c','b']
    else: hold=['right']
    e.run(1,hold); f+=1
    if f in shots: e.shot(OUT+shots[f]+'.png')
p,es,ph,cam,lv=st(); print(log); print('end frame',f,'phase',ph,'cam',cam,'lives',lv,'hp',p['hp'],'enemies',es,'audio samples',e.audio)
