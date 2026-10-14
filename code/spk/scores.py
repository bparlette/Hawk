from bench import read, fbank, nemo_feats
import onnxruntime as ort, numpy as np, glob
W={k:read(k+'.wav')[0] for k in ['fangjun-sr-1','fangjun-sr-2','fangjun-test-sr-1','leijun-sr-1','leijun-test-sr-1']}
def emb(s,f,x,mode):
    if 'nemo' in f:
        F,n=nemo_feats(x); return s.run(['embs'],{'audio_signal':F.T[None].copy(),'length':np.array([n],np.int64)})[0][0]
    if mode=='sherpa':
        if '3dspeaker' in f: F=fbank(x,scale=1.0); F=F-F.mean(0)
        else: F=fbank(x)          # wespeaker in sherpa: x32768, povey, no CMN
    else:  # official wespeaker / 3d-speaker style
        F=fbank(x, window='hamming' if 'wespeaker' in f or 'hf_' in f else 'povey', snip=True, high=0.0, scale=1.0 if '3dspeaker' in f else 32768.0); F=F-F.mean(0)
    return s.run(None,{s.get_inputs()[0].name:F[None]})[0][0]
n=lambda v:v/np.linalg.norm(v)
for f in sorted(glob.glob('*.onnx')):
    s=ort.InferenceSession(f,providers=['CPUExecutionProvider'])
    for mode in (['nemo'] if 'nemo' in f else ['sherpa','official']):
        for L in [None,32000]:
            g=lambda k: n(emb(s,f,W[k][:L] if L else W[k],mode))
            enr=n(g('fangjun-sr-1')+g('fangjun-sr-2'))
            same=enr@g('fangjun-test-sr-1'); diff=enr@g('leijun-test-sr-1'); diff2=enr@g('leijun-sr-1')
            print(f"{f[:45]:45s} {mode:8s} {'2s' if L else 'full':4s} same={same:.3f} diff={diff:.3f},{diff2:.3f}")
