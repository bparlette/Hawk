import subprocess, io
from PIL import Image, ImageDraw
ts=[1.8,2.8,3.8,4.8,5.6]; W=256; H=144
sheet=Image.new("RGB",(W*len(ts)+40,H*15),(0,0,0)); d=ImageDraw.Draw(sheet)
for r,n in enumerate(range(1,16)):
    d.text((4,r*H+60),"L%d"%n,fill=(255,255,0))
    for c,t in enumerate(ts):
        b=subprocess.run(["ffmpeg","-v","error","-ss",str(t),"-i","out/level%d.mp4"%n,"-frames:v","1","-vf","scale=%d:%d"%(W,H),"-f","image2pipe","-vcodec","mjpeg","-"],capture_output=True).stdout
        im=Image.open(io.BytesIO(b)).convert("RGB"); x=40+c*W
        sheet.paste(im,(x,r*H)); dd=ImageDraw.Draw(sheet)
        dd.line([(x+W//2,r*H),(x+W//2,r*H+H)],fill=(0,255,255)); dd.line([(x+W*3//4,r*H),(x+W*3//4,r*H+H)],fill=(255,0,0))
sheet.save("_tmp/contact_minis_recenter.jpg",quality=85); print(sheet.size)
