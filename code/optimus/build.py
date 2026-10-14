import subprocess,json
F="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def dur(f): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
T=1.15
segs=[ # (vo index, source, start, caption)
 (0,"img",0,"Tesla Optimus: the production ramp"),
 (1,"raw1.mp4",1,"Several hundred robots a week in August"),
 (2,"raw2.mp4",45,"Goal: 1,000+ a week by end of 2026"),
 (3,"raw1.mp4",64,"Robot parts are smaller, need tighter fits"),
 (4,"raw1.mp4",32,"Hand and joint stations misalign parts"),
 (5,"raw1.mp4",40,"100+ screws per hand, assembled manually"),
 (6,"raw1.mp4",56,"Suppliers struggle with quality at volume"),
 (7,"raw2.mp4",20,"AI still takes days to learn basic tasks"),
 (8,"raw2.mp4",5,"Most units: internal testing and data"),
 (9,"raw3.mp4",5,"Hundreds now. 20,000 a week is the goal."),
]
parts=[]
for i,(v,src,st,cap) in enumerate(segs):
    vo=f"vo{v:02d}.mp3"; d=dur(vo)/T+0.4
    cap=cap.replace(":","\\:").replace(",","\\,").replace("'","")
    dt=(f"drawbox=x=0:y=ih-170:w=iw:h=120:color=black@0.55:t=fill,"
        f"drawtext=fontfile={F}:text='{cap}':fontcolor=white:fontsize=54:x=(w-tw)/2:y=h-145")
    if src=="img":
        inp=["-loop","1","-t",f"{d}","-i","tweet.jpg"]
        vf=f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='min(zoom+0.0008,1.08)':d=1:s=1920x1080:fps=30,{dt}"
    elif src=="raw3.mp4":
        inp=["-ss",str(st),"-t",f"{d}","-i",src]
        vf=None
    else:
        inp=["-ss",str(st),"-t",f"{d}","-i",src]
        vf=f"scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,{dt}"
    out=f"seg{i:02d}.mp4"
    cmd=["ffmpeg","-y","-v","error"]+inp+["-i",vo]
    if vf: cmd+=["-filter_complex",f"[0:v]{vf},format=yuv420p[v];[1:a]atempo={T},apad[a]"]
    else: cmd+=["-filter_complex",f"[0:v]split[a0][b0];[a0]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=30[bg];[b0]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,fps=30,{dt},format=yuv420p[v];[1:a]atempo={T},apad[a]"]
    cmd+=["-map","[v]","-map","[a]","-t",f"{d}","-c:v","libx264","-preset","veryfast","-crf","21","-c:a","aac","-ar","44100","-ac","2",out]
    subprocess.run(cmd,check=True); parts.append(out); print(out,round(d,2))
open("parts.txt","w").write("".join(f"file '{p}'\n" for p in parts))
