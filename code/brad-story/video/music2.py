# Original synthwave / hair-metal-ish backing track for "Paradise Thunder". 120 BPM, A minor-ish.
import numpy as np, wave
SR = 44100
DUR = 47.0 + 1.0
N = int(SR * DUR)
out = np.zeros((N, 2))
BEAT = 0.5
rng = np.random.default_rng(7)

def t_arr(d): return np.arange(int(SR * d)) / SR
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR); j = min(N, i + len(sig)); sig = sig[: j - i] * gain
    out[i:j, 0] += sig * (1 - pan) ; out[i:j, 1] += sig * (1 + pan)
def env(n, a=0.005, r=0.1, d=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4))
    if d is not None: e *= np.exp(-t / d)
    rel = int(r * SR)
    if rel > 0 and rel < n: e[-rel:] *= np.linspace(1, 0, rel)
    return e
def saw(f, d, det=0.0):
    t = t_arr(d); s = 2 * ((t * f) % 1) - 1
    if det: s = 0.5 * s + 0.5 * (2 * ((t * f * (1 + det)) % 1) - 1)
    return s
def sq(f, d): t = t_arr(d); return np.sign(np.sin(2 * np.pi * f * t))
def lp(x, a):  # one-pole low-pass
    y = np.empty_like(x); acc = 0.0
    for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
    return y
def lpv(x, a):  # vectorised-ish approximate lowpass via cumulative filter (scipy-free): use FFT
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / a) ** 4); return np.fft.irfft(X, len(x))
def nf(n): return 440 * 2 ** ((n - 69) / 12)

def kick(): t = t_arr(0.35); f = 50 + 120 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR; return np.sin(ph) * np.exp(-t * 9)
def snare(): t = t_arr(0.25); n = rng.uniform(-1, 1, len(t)); return (0.7 * lpv(n, 6000) + 0.4 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 16)
def hat(o=False): t = t_arr(0.2 if o else 0.05); n = rng.uniform(-1, 1, len(t)); X = n - np.concatenate([[0], n[:-1]]); return X * np.exp(-t * (18 if o else 70))
def crash(): t = t_arr(2.0); n = rng.uniform(-1, 1, len(t)); X = n - np.concatenate([[0], n[:-1]]); return X * np.exp(-t * 2.2)
def gated_rev(x):  # 80s gated reverb-ish smear
    y = x.copy()
    for k, g in [(0.013, .5), (0.029, .4), (0.047, .35), (0.071, .3), (0.097, .25)]:
        s = int(k * SR); y[s:] += g * x[:-s]
    return y

K, S, H, HO, C = kick(), gated_rev(snare()), hat(), hat(True), crash()


import json
TL=json.load(open('timeline.json')); SC=TL['scenes']; TOT=TL['total']
def st(k): return SC[k][0]
prog = [57, 53, 55, 52]
def chord_at(t): return prog[int(t // 2) % 4]
def pad(a,b,cut=2600,g=0.18):
    t=a
    while t<b-1e-6:
        d=min(2.0-(t%2.0), b-t); r=chord_at(t)
        notes=[r,r+7,r+12,r+(3 if r in (57,52) else 4)+12]
        p=sum(saw(nf(n),d,0.006) for n in notes)/4
        p=lpv(p,cut)*env(len(p),0.08,0.1); add(p,t,0,g); t+=d
def drums(a,b,heavy=False,half=False):
    t=a;i=0
    while t<b-1e-6:
        beat=i%4
        if half:
            if beat==0: add(K,t,0,0.9)
            if beat==2: add(S,t,0,0.6)
        else:
            if beat in (0,2) or heavy: add(K,t,0,0.9)
            if beat in (1,3): add(S,t,0,0.55 if not heavy else 0.7)
            add(H,t+0.25,0.3,0.18)
            if heavy: add(K,t+0.25,0,0.6)
        add(H,t,-0.3,0.12); t+=BEAT;i+=1
def bass(a,b,step=0.25):
    t=a
    while t<b-1e-6:
        r=chord_at(t)-24
        s=(saw(nf(r),step*0.95)+0.5*sq(nf(r)/2,step*0.95))*env(int(step*0.95*SR),0.003,0.04)
        add(lpv(s,900),t,0,0.35); t+=step
def guitar(a,b,gain=0.16):
    t=a;i=0
    while t<b-1e-6:
        r=chord_at(t)-12; d=0.22 if i%4 else 0.45
        s=saw(nf(r),d,0.01)+saw(nf(r+7),d,0.012)+0.6*saw(nf(r+12),d)
        s=np.tanh(s*4.0); s=lpv(s,3200)*env(len(s),0.003,0.05)
        add(s,t,-0.4 if i%2 else 0.4,gain); t+=0.25;i+=1
def lead(notes,start,step=0.25,gain=0.12,end=None):
    for k,n in enumerate(notes):
        if n is None: continue
        if end and start+k*step>=end: break
        d=step*0.95; t=t_arr(d)
        vib=1+0.004*np.sin(2*np.pi*6*t)*np.minimum(1,t*4)
        ph=2*np.pi*np.cumsum(nf(n)*vib)/SR
        s=np.tanh(3*(2*((ph/(2*np.pi))%1)-1))*env(len(t),0.01,0.05)
        add(lpv(s,4000),start+k*step,0.1,gain)
def swoosh(t0,d,g=0.5,up=True):
    n=int(d*SR); w=rng.uniform(-1,1,n)*(np.linspace(0,1,n)**3 if up else np.linspace(1,0,n)**2)
    add(lpv(w,5000),t0,0,g)

# intro (flyover)
pad(0,st('p01'),1600,0.2)
for i in range(int(st('p01')/0.25)):
    t=i*0.25; r=chord_at(t); n=[r+12,r+19,r+24,r+19][i%4]
    s=sq(nf(n),0.22)*env(int(0.22*SR),0.003,0.05,0.12); add(lpv(s,1500+i*200),t,0.3*(1 if i%2 else -1),0.10)
swoosh(0,st('p01'),0.12)
add(C,st('p01'),0,0.35)
# verse to slow-mo
A=st('p01'); B=st('p07b')
pad(A,B); drums(A,B); bass(A,B); guitar(st('p03'),B,0.10)
hook=[69,None,72,74,76,None,74,72,74,None,72,69,67,None,64,67]
for s0 in (st('p03'), st('p03')+4, st('p06'), st('p06')+4):
    if s0<B: lead(hook if int(s0)%8<4 else hook[::-1], s0, end=B)
add(C,st('p06b'),0,0.4); add(K,st('p06b'),0,1.0)
add(C,st('p07'),0,0.3)
# slow-mo swell
A=st('p07b'); B=st('p07c')
d=B-A; n=int(d*SR)
for nn in (57,64,69,72,76,81):
    s=saw(nf(nn-12),d,0.008); s=lpv(s,3500)*np.linspace(0.15,1,n)**1.5
    add(s,A,0,0.06)
rv=rng.uniform(-1,1,n)*np.linspace(0,1,n)**4; add(lpv(rv,8000),A,0,0.18)
drums(A,B,half=True); bass(A,B,0.5)
lead([76,None,None,None,79,None,None,None,81,None,None,None,None,None,None,None],A,0.25,0.11,end=B)
add(C,B,0,0.4)
# comic groove to standoff
A=st('p07c'); B=st('p09')
pad(A,B); drums(A,B); bass(A,B); guitar(st('p08a'),B,0.11)
lead(hook,A,end=st('p08a')); lead(hook[::-1],st('p08a'),end=B)
add(C,st('p08'),0,0.4)
# standoff tension
A=st('p09'); B=st('p09b')
pad(A,B,900,0.12); t=A
while t<B-0.01:
    add(K,t,0,0.6); s=saw(nf(40),0.2)*env(int(0.2*SR),0.003,0.05); add(lpv(s,500),t,0,0.4); add(HO,t+0.25,0.4,0.1); t+=0.5
# shirt rip: crash + chug riser
A=st('p09b'); B=st('p10')
add(C,A,0,0.5); add(K,A,0,1.0)
t=A;i=0
while t<B-0.2:
    r=45; s=np.tanh(4*(saw(nf(r),0.11)+saw(nf(r+7),0.11)))*env(int(0.11*SR),0.002,0.03); add(lpv(s,2500+i*120),t,0,0.14); t+=0.125;i+=1
swoosh(B-0.45,0.45,0.55)
# fight
A=st('p10'); B=st('p11b')
add(C,A,0,0.5)
for h in TL['hits']: add(K,h,0,1.0); add(S,h,0,0.7)
pad(A,B,3000,0.14); drums(A,B,heavy=True); bass(A,B); guitar(A,B,0.17)
lead([76,79,81,79,76,74,76,None,81,83,84,83],A+0.5,0.2,0.11,end=B)
# dogs: light bouncy
A=st('p11b'); B=st('p11')
pad(A,B,2000,0.12); drums(A,B); bass(A,B,0.5)
lead([81,None,79,None,76,None,79,81],A+0.25,0.25,0.09,end=B)
# aftermath until freeze
A=st('p11'); FZ=A+1.2
pad(A,FZ,3000,0.16); drums(A,FZ); bass(A,FZ); guitar(A,FZ,0.14); add(C,A,0,0.35)
# freeze hit + tape stop
add(K,FZ,0,1.0); add(C,FZ,0,0.45)
d=st('end')-FZ; t=t_arr(d); f=110*np.exp(-t*3); ph=2*np.pi*np.cumsum(f)/SR
add(np.tanh(3*np.sin(ph))*np.exp(-t*2.5),FZ,0,0.25)
# THE END? stinger dun-dun-DUN
E=st('end')
for k,(tt,nn) in enumerate([(0.0,45),(0.35,44),(0.7,40)]):
    dd=0.3 if k<2 else 0.5
    s=np.tanh(3*(saw(nf(nn),dd,0.01)+saw(nf(nn+7),dd)))*env(int(dd*SR),0.003,0.08)
    add(lpv(s,2500),E+tt,0,0.22); add(K,E+tt,0,0.9)
# finale
A=st('p12'); add(C,A+0.1,0,0.5); add(K,A+0.1,0,1.0)
drums(A,A+2.0); bass(A,A+2.0); guitar(A,A+2.0,0.13)
lead([69,72,76,81,None,79,81,None],A,0.25,0.11)
for nn in (57,64,69,72,76):
    s=np.tanh(3*saw(nf(nn-12),TOT-(A+2.0),0.01))*env(int((TOT-(A+2.0))*SR),0.01,0.6,1.4)
    add(lpv(s,3000),A+2.0,0,0.09)
add(K,A+2.0,0,1.0); add(C,A+2.0,0,0.4)

out=out[:int(TOT*SR)]
fade=int(0.8*SR); out[-fade:]*=np.linspace(1,0,fade)[:,None]
out/=np.max(np.abs(out))+1e-9; out*=0.89
pcm=(out*32767).astype(np.int16)
with wave.open('pt/assets/music.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok',len(out)/SR)
