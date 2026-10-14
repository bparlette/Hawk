import re, urllib.request, urllib.parse, concurrent.futures, json, ssl
BASE="https://bparlette.github.io/Offtherip/"
UA={"User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36","Accept-Language":"en-US"}
def get(u, method="GET"):
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA,method=method),timeout=25)
        return r.status, r.geturl(), (r.read() if method=="GET" else b"")
    except urllib.error.HTTPError as e: return e.code, u, b""
    except Exception as e: return str(e)[:60], u, b""
pages={}; links={}  # link -> set of pages
queue=[BASE]; seen=set()
while queue:
    u=queue.pop(0)
    if u in seen: continue
    seen.add(u)
    s,final,body=get(u); pages[u]=(s,final)
    if s!=200: continue
    html=body.decode("utf8","ignore")
    for attr,v in re.findall(r'(href|src|action|content)="([^"]+)"',html):
        if v.startswith("data:") or (attr=="content" and not v.startswith(("http","/"))): continue
        full=urllib.parse.urljoin(u,v.replace("&amp;","&"))
        links.setdefault(full,set()).add(u.replace(BASE,"/"))
        p=urllib.parse.urlparse(full)
        if p.netloc=="bparlette.github.io" and p.path.startswith("/Offtherip/") and (p.path.endswith("/") or p.path.endswith(".html")):
            nu=full.split("#")[0]
            if nu not in seen: queue.append(nu)
json.dump({"pages":pages,"links":{k:sorted(v) for k,v in links.items()}},open("crawl.json","w"),indent=1)
print(len(pages),"pages",len(links),"links")
for k,v in pages.items():
    if v[0]!=200: print("PAGE",v,k)
