import json
tl=json.load(open('timeline.json'))['scenes']
order=['p00','p03','p04','p04b','p05','p06','p06b','p01','p02','p07','p07b','p07c','p08a','p08','p09','p09b','p10','p11b','p11','p12']
bub={'p02','p03','p05','p06','p06b','p07','p07c','p08a','p09','p10','p12'}
freeze_at={'p12':2.6}  # offset; default = end of scene
parts=[]  # (name, src_start, dur, freeze_after)
for s in order:
    st,d=tl[s]
    if s in bub:
        f=freeze_at.get(s,d)
        parts.append((s+'a',st,f,1.0))
        if f<d: parts.append((s+'b',st+f,d-f,0.0))
    else: parts.append((s,st,d,0.0))
json.dump(parts,open('cut4/parts.json','w'),indent=0)
print(sum(p[2]+p[3] for p in parts)); print(parts)
