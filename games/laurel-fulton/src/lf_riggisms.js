// lf_riggisms.js — Rigg's catchphrases (owner, Nov 18): he RANDOMLY says "IGURT GOGURT" and "fuck shit diesel", over his head,
// on foot or in his car or indoors. Ambient and light: one bark every ~14-30 s, up for ~2.4 s, never the same line twice in a row.
// Pure logic (lf_interior.js, main.js and tools/spec_l7b.mjs share it); drawing is bubbleAt() below / the interior renderer's bubble.
export const RIGGISMS = ['IGURT GOGURT', 'fuck shit diesel'];
const rngOf = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

export class Barker {
  constructor(seed = 1998, lines = RIGGISMS, gap = [14, 30], hold = 2.4) {
    this.rnd = rngOf(seed); this.lines = lines; this.gap = gap; this.hold = hold; this.t = 3 + this.rnd() * 8; this.said = null; this.sayT = 0; this.last = -1; this.count = 0;
  }
  // advance dt seconds; returns the line on the step a new bark starts, else null
  step(dt) {
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) this.said = null; }
    if ((this.t -= dt) > 0) return null;
    let i = Math.floor(this.rnd() * this.lines.length); if (i === this.last) i = (i + 1) % this.lines.length;
    this.last = i; this.said = this.lines[i]; this.sayT = this.hold; this.count++;
    this.t = this.gap[0] + this.rnd() * (this.gap[1] - this.gap[0]);
    return this.said;
  }
}
// a speech bubble over a screen point (the same look as the interiors' bubble): used by main.js for Rigg on the street
export function bubbleAt(g, x, y, text, a = 1, vw = 420) {
  g.save(); g.globalAlpha = a; g.font = '800 12px system-ui'; const w = g.measureText(text).width + 18; x = Math.max(w / 2 + 6, Math.min(vw - w / 2 - 6, x));
  g.fillStyle = 'rgba(255,248,232,0.97)'; g.strokeStyle = '#2a1430'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(x - w / 2, y - 26, w, 24, 10); g.fill(); g.stroke();
  g.fillStyle = '#2a1430'; g.textAlign = 'center'; g.fillText(text, x, y - 10); g.restore();
}
