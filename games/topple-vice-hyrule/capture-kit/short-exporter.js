/**
 * Reusable vertical 9:16 Make-Short exporter.
 * Captures canvas.captureStream(fps) fused with live WebAudio MediaStreamDestination
 * in one synchronized MediaRecorder stream while replaying a StuntBot or ReplayPlayer run.
 */

const MIME_PREFERENCES = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.5', ext: 'mp4' },
  { mimeType: 'video/mp4', ext: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
  { mimeType: 'video/webm', ext: 'webm' },
];

export function selectBestMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API is not supported in this browser');
  }
  for (const cand of MIME_PREFERENCES) {
    if (MediaRecorder.isTypeSupported(cand.mimeType)) {
      return cand;
    }
  }
  return { mimeType: '', ext: 'webm' };
}

export async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export class ShortExporter {
  constructor({ fps = 60, videoBitsPerSecond = 6_000_000, audioBitsPerSecond = 128_000 } = {}) {
    this.fps = fps;
    this.videoBitsPerSecond = videoBitsPerSecond;
    this.audioBitsPerSecond = audioBitsPerSecond;
    this.exporting = false;
  }

  /**
   * Replays the StuntBot run (or ReplayPlayer run) in real time and captures
   * synced canvas video + WebAudio output into a downloadable video file.
   */
  async exportRun({
    game,
    stuntBot = null,
    replayPlayer = null,
    recorder = null,
    canvas,
    audioBus,
    filename = 'topple-vice-hyrule-short',
    triggerDownload = true,
    onProgress = null,
  }) {
    if (this.exporting) {
      throw new Error('ShortExporter: export already in progress');
    }
    if (!canvas) throw new Error('ShortExporter: canvas is required');

    this.exporting = true;
    const startWallMs = performance.now();

    try {
      const audioStream = audioBus && typeof audioBus.getMediaStream === 'function'
        ? await audioBus.getMediaStream()
        : null;

      if (audioBus && typeof audioBus.startBed === 'function') {
        audioBus.startBed();
      }

      const canvasStream = canvas.captureStream(this.fps);
      const tracks = [...canvasStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const combinedStream = new MediaStream(tracks);

      const { mimeType, ext } = selectBestMimeType();
      const recOpts = {
        videoBitsPerSecond: this.videoBitsPerSecond,
        audioBitsPerSecond: this.audioBitsPerSecond,
      };
      if (mimeType) recOpts.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(combinedStream, recOpts);
      const chunks = [];
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stopPromise = new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.onerror = (ev) => reject(ev.error || new Error('MediaRecorder error'));
      });

      // Reset & start driver before starting recorder so frame 0 is clean
      if (replayPlayer) {
        replayPlayer.start(game);
      } else if (stuntBot) {
        stuntBot.start(game, recorder);
      } else {
        throw new Error('ShortExporter: provide either stuntBot or replayPlayer');
      }

      if (typeof game.render === 'function') {
        game.render();
      }

      mediaRecorder.start(100);

      // Drive simulation in real-time 60Hz steps synced with wall-clock so video & audio align 1:1
      const stepMs = 1000 / 60;
      await new Promise((resolve) => {
        let lastTime = performance.now();
        let acc = 0;
        let active = true;

        const frame = (now) => {
          const dt = Math.min(now - lastTime, 50);
          lastTime = now;
          acc += dt;

          let ticksThisFrame = 0;
          while (acc >= stepMs && ticksThisFrame < 4 && active) {
            if (replayPlayer) {
              active = replayPlayer.stepTick(game);
            } else {
              active = stuntBot.stepTick(game, recorder);
            }
            acc -= stepMs;
            ticksThisFrame++;
          }

          if (typeof game.render === 'function') {
            game.render();
          }

          if (onProgress) {
            onProgress({
              tick: game.tick,
              score: typeof game.getScore === 'function' ? game.getScore() : 0,
            });
          }

          if (active) {
            requestAnimationFrame(frame);
          } else {
            // Brief tail so final fireworks frames & audio decay flush cleanly into MediaRecorder
            setTimeout(resolve, 240);
          }
        };

        requestAnimationFrame(frame);
      });

      mediaRecorder.stop();
      await stopPromise;

      for (const t of canvasStream.getTracks()) t.stop();

      const resolvedType = mediaRecorder.mimeType || mimeType || `video/${ext}`;
      const blob = new Blob(chunks, { type: resolvedType });
      const base64 = await blobToBase64(blob);
      const fullFilename = `${filename}.${ext}`;

      if (triggerDownload && typeof document !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fullFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 1500);
      }

      const result = {
        filename: fullFilename,
        mimeType: resolvedType,
        ext,
        byteLength: blob.size,
        durationMs: Math.round(performance.now() - startWallMs),
        totalTicks: game.tick,
        finalScore: typeof game.getScore === 'function' ? game.getScore() : 0,
        digest: typeof game.getDigest === 'function' ? game.getDigest() : '',
        stats: typeof game.getStats === 'function' ? game.getStats() : {},
        blob,
        base64,
      };

      if (typeof globalThis !== 'undefined') {
        globalThis.__lastExportedShort = result;
      }

      return result;
    } finally {
      this.exporting = false;
    }
  }
}
