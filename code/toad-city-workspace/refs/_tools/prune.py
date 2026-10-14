import json,os,sys
for item in sys.argv[1:]:
    slug,fn=item.split("/")
    f=f"{slug}/sources.json"; s=json.load(open(f))
    s.pop(fn,None); json.dump(s,open(f,"w"),indent=1)
    if os.path.exists(item): os.remove(item)
