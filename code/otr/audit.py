import json,re,urllib.request,html as H
from html.parser import HTMLParser
pages=list(json.load(open("crawl.json"))["pages"])
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=20).read().decode()
def text(h):
    h=re.sub(r"<(script|style|svg)[\s\S]*?</\1>","",h); h=re.sub(r"<[^>]+>"," ",h); return re.sub(r"\s+"," ",H.unescape(h)).strip()
for u in pages:
    h=get(u); n=u.split("Offtherip")[1].strip("/").replace("/","_") or "home"
    open(f"pages/{n}.html","w").write(h); open(f"pages/{n}.txt","w").write(text(h))
    t=re.search(r"<title>(.*?)</title>",h,re.S); d=re.search(r'name="description" content="([^"]*)"',h)
    ids=re.findall(r'\sid="([^"]+)"',h); dup={i for i in ids if ids.count(i)>1}
    imgs=re.findall(r"<img[^>]*>",h); noalt=[i[:80] for i in imgs if 'alt=' not in i]
    h1=len(re.findall(r"<h1",h))
    anchors=[a for a in re.findall(r'href="#([^"]+)"',h) if a not in ids]
    emptylinks=re.findall(r'<a[^>]*href="(#|)"',h)
    flags=re.findall(r"(?i)(lorem|todo|tbd|coming soon|undefined|NaN|null|\{\{|\$\{|placeholder|xxx|0[–-]7)",text(h))
    print(f"== {n} | title={t.group(1).strip()[:60] if t else None!r} | desc={'yes' if d else 'NO'}({len(d.group(1)) if d else 0}) | h1={h1} | imgs={len(imgs)} noalt={len(noalt)} | dupIDs={dup or ''} | badAnchors={anchors or ''} | emptyHref={len(emptylinks)} | flags={sorted(set(flags))}")
