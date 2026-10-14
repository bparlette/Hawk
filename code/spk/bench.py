import onnxruntime as ort, numpy as np, time, glob, wave, kaldi_native_fbank as knf
def read(f):
    with wave.open(f) as w:
        sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
    return x,sr
def fbank(x, window='povey', snip=False, high=-400.0, scale=32768.0):
    o=knf.FbankOptions(); o.frame_opts.dither=0; o.frame_opts.samp_freq=16000; o.frame_opts.snip_edges=snip
    o.frame_opts.window_type=window; o.mel_opts.num_bins=80; o.mel_opts.high_freq=high
    fb=knf.OnlineFbank(o); fb.accept_waveform(16000,(x*scale).tolist()); fb.input_finished()
    return np.stack([fb.get_frame(i) for i in range(fb.num_frames_ready)]).astype(np.float32)
def nemo_feats(x):
    o=knf.FbankOptions(); o.frame_opts.samp_freq=16000; o.frame_opts.frame_length_ms=25; o.frame_opts.frame_shift_ms=10
    o.frame_opts.dither=0; o.frame_opts.remove_dc_offset=False; o.frame_opts.window_type='hann'
    o.mel_opts.num_bins=80; o.mel_opts.low_freq=0; o.mel_opts.is_librosa=True
    fb=knf.OnlineFbank(o); fb.accept_waveform(16000,x.tolist()); fb.input_finished()
    F=np.stack([fb.get_frame(i) for i in range(fb.num_frames_ready)]).astype(np.float32)
    F=(F-F.mean(0,keepdims=True))/(F.std(0,keepdims=True)+1e-5); n=F.shape[0]; pad=16-n%16
    F=np.concatenate([F,np.zeros((pad,80),np.float32)]); return F, n
x,_=read('leijun-test-sr-1.wav'); x2=x[:32000]
import sys
threads=[1,2]
for f in sorted(glob.glob('*.onnx')):
    for t in threads:
        so=ort.SessionOptions(); so.intra_op_num_threads=t; so.inter_op_num_threads=1
        s=ort.InferenceSession(f,so,providers=['CPUExecutionProvider'])
        if 'nemo' in f:
            F,n=nemo_feats(x2); feed={'audio_signal':F.T[None].copy(),'length':np.array([n],np.int64)}
        else:
            F=fbank(x2); F=F-F.mean(0); feed={s.get_inputs()[0].name:F[None]}
        for _ in range(3): s.run(None,feed)
        ts=[]
        for _ in range(15):
            t0=time.perf_counter(); s.run(None,feed); ts.append((time.perf_counter()-t0)*1000)
        print(f"{f:55s} threads={t} frames={F.shape[0]} median={np.median(ts):.1f}ms")
t0=time.perf_counter()
for _ in range(20): fbank(x2)
print('fbank 2s ms', (time.perf_counter()-t0)/20*1000)
