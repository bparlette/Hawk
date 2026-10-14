import sys,json,os,subprocess
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
for line in sys.stdin.read().strip().splitlines():
    slug,name,url,page=line.split("|")
    fn=f"{slug}/{name}.jpg"; tmp=fn+".tmp"
    subprocess.run(["curl","-sL","--max-time","25","-A",UA,"-o",tmp,url])
    ft=subprocess.run(["file","-b",tmp],capture_output=True,text=True).stdout if os.path.exists(tmp) else ""
    if os.path.exists(tmp) and os.path.getsize(tmp)>20000 and "image" in ft:
        subprocess.run(["magick",tmp+"[0]","-auto-orient","-resize","1600x1600>","-quality","88",fn]); os.remove(tmp)
        f=f"{slug}/sources.json"; s=json.load(open(f)) if os.path.exists(f) else {}
        s[name+".jpg"]=dict(title=name,page=page,image=url); json.dump(s,open(f,"w"),indent=1); print("OK",fn)
    else:
        print("FAIL",fn,ft[:40]); os.path.exists(tmp) and os.remove(tmp)
