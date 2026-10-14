"""Speaker verification with a WeSpeaker/3D-Speaker/sherpa-onnx ONNX model + onnxruntime.

pip install onnxruntime kaldi-native-fbank numpy soundfile
Model (recommended): https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_CAM%2B%2B.onnx
(same weights as https://huggingface.co/Wespeaker/wespeaker-voxceleb-campplus/resolve/main/voxceleb_CAM%2B%2B.onnx
 plus sherpa metadata).

Front-end below follows the OFFICIAL WeSpeaker recipe (wespeaker/bin/infer_onnx.py):
16 kHz mono, samples scaled to int16 range, 80-dim Kaldi fbank, 25 ms / 10 ms,
hamming window, dither 0, then CMN (subtract per-utterance mean, no variance norm).
Do NOT skip CMN: sherpa-onnx's C++ path does not apply CMN for 'wespeaker' models,
and WeSpeaker ResNets collapse without it (different speakers scored ~0.8).
"""
import numpy as np
import onnxruntime as ort
import kaldi_native_fbank as knf


class SpeakerEmbedder:
    def __init__(self, path, threads=2):
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.sess = ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])
        inp, out = self.sess.get_inputs()[0], self.sess.get_outputs()[0]
        print("inputs:", [(i.name, i.shape, i.type) for i in self.sess.get_inputs()])
        print("outputs:", [(o.name, o.shape) for o in self.sess.get_outputs()])
        meta = self.sess.get_modelmeta().custom_metadata_map  # empty for HF/official files
        print("metadata:", meta)
        # WeSpeaker: input 'feats' [B,T,80], output 'embs'. 3D-Speaker (sherpa): 'x' -> 'embedding'.
        self.in_name, self.out_name = inp.name, out.name
        framework = meta.get("framework", "wespeaker")
        # wespeaker expects samples in [-32768, 32767]; 3d-speaker expects [-1, 1]
        self.scale = 32768.0 if meta.get("normalize_samples", "0") == "0" else 1.0
        self.window = "hamming" if framework == "wespeaker" else "povey"

    def fbank(self, wav_f32_16k):
        o = knf.FbankOptions()
        o.frame_opts.samp_freq = 16000
        o.frame_opts.frame_length_ms = 25
        o.frame_opts.frame_shift_ms = 10
        o.frame_opts.dither = 0.0
        o.frame_opts.window_type = self.window
        o.frame_opts.snip_edges = True          # torchaudio kaldi.fbank default
        o.mel_opts.num_bins = 80
        o.mel_opts.high_freq = 0.0              # torchaudio default (Nyquist)
        fb = knf.OnlineFbank(o)
        fb.accept_waveform(16000, (wav_f32_16k * self.scale).astype(np.float32).tolist())
        fb.input_finished()
        F = np.stack([fb.get_frame(i) for i in range(fb.num_frames_ready)]).astype(np.float32)
        return F - F.mean(axis=0, keepdims=True)  # CMN (no CVN)

    def embed(self, wav_f32_16k):
        F = self.fbank(wav_f32_16k)[None]       # [1, T, 80]; 2 s -> ~198 frames
        e = self.sess.run([self.out_name], {self.in_name: F})[0][0]
        return e.astype(np.float32)


def l2n(v):
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-12)


def cosine(a, b):
    return float(l2n(a) @ l2n(b))


def build_enrollment(embs, domain_mean=None):
    """embs: list of raw embeddings from enrollment clips. Returns (centroid, per-clip matrix)."""
    E = np.stack(embs)
    if domain_mean is not None:
        E = E - domain_mean                    # optional: mean of embeddings recorded in the room
    E = l2n(E)
    return l2n(E.mean(axis=0)), E


def asnorm(raw, enr, test, cohort, top_k=100):
    """Adaptive symmetric score normalisation (as in wespeaker/bin/score_norm.py).
    enr/test: L2-normalised vectors; cohort: [N, D] L2-normalised impostor embeddings."""
    se = np.sort(cohort @ enr)[::-1][:top_k]
    st = np.sort(cohort @ test)[::-1][:top_k]
    return 0.5 * ((raw - se.mean()) / (se.std() + 1e-6) + (raw - st.mean()) / (st.std() + 1e-6))


if __name__ == "__main__":
    import sys, wave
    def read(p):
        with wave.open(p) as w:
            assert w.getframerate() == 16000
            x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
            return x.reshape(-1, w.getnchannels())[:, 0]
    m = SpeakerEmbedder(sys.argv[1])
    enr_c, _ = build_enrollment([m.embed(read(p)[:32000]) for p in sys.argv[2:4]])
    for p in sys.argv[4:]:
        print(p, round(cosine(enr_c, m.embed(read(p)[:32000])), 3))
