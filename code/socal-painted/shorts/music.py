# Procedural surf-rock bed for the Short (same original tune as the game's synth: bass + tremolo lead + drums). Writes shorts/music.wav
import numpy as np, wave, sys
SR=44100; BPM=152; SPB=60/BPM/4; dur=float(sys.argv[1]) if len(sys.argv)>1 else 30
BASS=[40,0,40,40,43,0,40,0,45,0,45,43,40,0,38,0, 45,0,45,45,48,0,45,0,47,0,47,45,43,0,42,0, 40,0,40,40,43,0,40,0,45,0,45,43,40,0,38,0, 47,0,47,47,50,0,47,0,45,0,45,43,42,0,43,0]
LEAD=[64,-1,67,-1,69,-1,71,-1,74,-1,71,69,67,-1,64,-1, 69,-1,72,-1,74,-1,76,-1,74,72,69,-1,67,-1,69,-1, 64,-1,67,-1,69,-1,71,-1,76,-1,74,71,69,-1,67,-1, 71,-1,74,-1,71,-1,69,-1,67,-1,66,-1,64,-1,-1,-1]
f=lambda m:440*2**((m-69)/12)
N=int(SR*dur); out=np.zeros(N)
def add(sig,t0):
    i=int(t0*SR); j=min(N,i+len(sig)); 
    if i<N: out[i:j]+=sig[:j-i]
def env(n,dec): t=np.arange(n)/SR; return np.exp(-t/dec)
rng=np.random.default_rng(1)
steps=int(dur/SPB)
for s in range(steps):
    t=s*SPB; i=s%64; b=i%16
    if b in (0,8,10):
        n=int(0.16*SR); tt=np.arange(n)/SR; fr=140*np.exp(-tt*18)+42; add(0.6*np.sin(2*np.pi*np.cumsum(fr)/SR)*env(n,0.06),t)
    if b in (4,12): n=int(0.16*SR); add(0.25*rng.uniform(-1,1,n)*env(n,0.05),t)
    if b%2==0: n=int(0.03*SR); add(0.06*rng.uniform(-1,1,n)*env(n,0.008),t)
    if BASS[i]:
        n=int(SPB*1.8*SR); tt=np.arange(n)/SR; ph=(tt*f(BASS[i]))%1; add(0.22*(2*ph-1)*env(n,0.12),t)
    ln=LEAD[i]; j=i
    while ln==-1 and j>0: j-=1; ln=LEAD[j]
    if ln>0:
        for k in range(2):
            n=int(SPB*0.45*SR); tt=np.arange(n)/SR; ph=(tt*f(ln))%1; add(0.09*(1 if k==0 else .75)*(2*ph-1)*env(n,0.05),t+k*SPB/2)
# cheap spring reverb
d1=int(0.083*SR); d2=int(0.131*SR); y=out.copy()
for d,g in ((d1,0.35),(d2,0.3)):
    for r in range(3): y[d*(r+1):]+=out[:-d*(r+1)]*(g**(r+1))
y=np.tanh(y*1.2)*0.8
w=wave.open(sys.argv[2] if len(sys.argv)>2 else 'music.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y*32767).astype(np.int16).tobytes()); w.close()
