import json, wave, numpy as np
SR=48000
w=wave.open('cut4/a_v3.wav'); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).reshape(-1,2).astype(np.float32)
parts=json.load(open('cut4/parts.json'))
out=[]; F=int(0.012*SR)
def fade(x):
    x=x.copy(); r=np.linspace(0,1,F)[:,None]; x[:F]*=r; x[-F:]*=r[::-1]; return x
for n,st,d,fz in parts:
    i=round(st*30)*SR//30; j=i+round(d*30)*SR//30
    seg=a[i:j]
    if len(seg)<j-i: seg=np.vstack([seg,np.zeros((j-i-len(seg),2),np.float32)])
    out.append(fade(seg) if n not in('p00',) else seg)
    if fz:
        L=int(fz*SR); out.append(fade(seg[-L:]))   # loop last 1.0 s (2 beats @120 BPM)
y=np.vstack(out)
# keep the original final fade-to-black: nothing else needed; clip safety
y=np.clip(y,-32768,32767).astype(np.int16)
o=wave.open('cut4/a_new.wav','wb'); o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR); o.writeframes(y.tobytes()); print(len(y)/SR)
