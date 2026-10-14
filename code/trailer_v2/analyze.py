import json,sys,collections,glob,os
for d in sys.argv[1:]:
    M=[json.loads(l) for l in open(d+'/meta.jsonl') if l.strip()]
    E=[json.loads(l) for l in open(d+'/events.jsonl') if l.strip()]
    ev=collections.Counter(e['s'].split(' ')[0] for e in E)
    bossf=[m for m in M if m.get('boss') and m['scene']=='stage' and m['boss']['state'] not in ('intro','enter','pose','breach','dying')]
    names=collections.OrderedDict()
    for m in bossf: names.setdefault(m['boss']['name'],[]).append(m)
    res=next((i for i,m in enumerate(M) if m.get('results')),None)
    print(f"== {d}: {len(M)} fr ({len(M)/30:.0f}s) results@{res} end={M[-1]['scene']} lvl={M[-1].get('level')} ev={dict(ev)}")
    for n,ms in names.items():
        sx=[m['boss']['sx'] for m in ms]; ok=sum(1 for x in sx if 90<=x<=300)
        edge=sum(1 for x in sx if x>330 or x<40)
        ps=[m['psx'] for m in ms]
        print(f"   boss {n}: {len(ms)/30:.0f}s  centred(90-300) {100*ok/len(ms):.0f}%  edge {100*edge/len(ms):.0f}%  boss sx med {sorted(sx)[len(sx)//2]}  player sx med {sorted(ps)[len(ps)//2]}  p2={any(m['boss']['p2'] for m in ms)} lasthp={ms[-1]['boss']['hp']}")
    mc=collections.Counter(m.get('mode','').split('-')[0] for m in M if m['scene']=='stage')
    print('   modes',dict(mc.most_common(8)))
