import json,urllib.request,concurrent.futures,urllib.parse
d=json.load(open("crawl.json"))
UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36","Accept-Language":"en-US","Accept":"text/html,*/*"}
def chk(u):
    if u.startswith(("mailto:","tel:","javascript:")): return u,"skip",u,""
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=25)
        b=r.read(300000).decode("utf8","ignore")
        t=""
        import re
        m=re.search(r"<title[^>]*>(.*?)</title>",b,re.S); t=(m.group(1).strip()[:70] if m else "")
        return u,r.status,r.geturl(),t
    except urllib.error.HTTPError as e: return u,e.code,u,""
    except Exception as e: return u,"ERR "+str(e)[:50],u,""
with concurrent.futures.ThreadPoolExecutor(16) as ex: res=list(ex.map(chk,d["links"]))
json.dump(res,open("results.json","w"),indent=1)
for u,s,f,t in sorted(res,key=lambda x:str(x[1])):
    flag="" if s==200 and f.rstrip("/")==u.split("#")[0].rstrip("/") else " <-- "+str(f)
    print(s,u,"|",t,flag, "| on:",",".join(d["links"][u][:3]))
print("PAGES:",list(d["pages"].keys()))
