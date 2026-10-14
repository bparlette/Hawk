import json,sys,os,subprocess,urllib.parse,urllib.request,time
UA="ToadCityRefs/1.0 (rbparle@gmail.com)"
def search(q,n=6):
    u="https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(dict(action="query",format="json",generator="search",gsrnamespace=6,gsrsearch=q+" filetype:bitmap",gsrlimit=n,prop="imageinfo",iiprop="url|size|mime",iiurlwidth=1280))
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA})))
    pages=sorted(d.get("query",{}).get("pages",{}).values(),key=lambda p:p.get("index",99))
    return [(p["title"],p["imageinfo"][0]["thumburl"],p["imageinfo"][0]["descriptionurl"]) for p in pages if p.get("imageinfo") and p["imageinfo"][0].get("mime") in("image/jpeg","image/png")]
spec=json.load(open(sys.argv[1]))
for slug,qs in spec.items():
    os.makedirs(slug,exist_ok=True)
    srcf=os.path.join(slug,"sources.json")
    src=json.load(open(srcf)) if os.path.exists(srcf) else {}
    seen={v["title"] for v in src.values()}
    for label,q,n in qs:
        try: res=search(q,8)
        except Exception as e: print(slug,q,"ERR",e); continue
        k=0
        for t,url,desc in res:
            if t in seen: continue
            if k>=n: break
            fn=f"{slug}/{label}_{k+1}.jpg"
            subprocess.run(["curl","-sL","-A",UA,"-o",fn,url])
            ok=os.path.exists(fn) and os.path.getsize(fn)>20000 and "image" in subprocess.run(["file","-b",fn],capture_output=True,text=True).stdout
            if not ok:
                os.remove(fn) if os.path.exists(fn) else None; continue
            seen.add(t); src[os.path.basename(fn)]=dict(title=t,page=desc,query=q); k+=1
        print(slug,label,q,"->",k)
        time.sleep(0.3)
    json.dump(src,open(srcf,"w"),indent=1)
