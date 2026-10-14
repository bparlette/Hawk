// canvas stub that records every 2D call (for determinism hashing) and answers measureText / gradients / patterns
export const LOG = [];
const fmt = (a) => a.map((x) => typeof x === 'number' ? x.toFixed(3) : (x && typeof x === 'object') ? 'obj' : String(x)).join(',');
function grad() { return { addColorStop: (...a) => LOG.push('stop(' + fmt(a) + ')') }; }
function ctx(canvas) {
  const st = { font: '10px sans-serif' };
  return new Proxy(st, {
    get(t, k) {
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return (s) => { const px = parseFloat((/(\d+(?:\.\d+)?)px/.exec(t.font) || [0, 10])[1]); LOG.push('mt(' + s + ')'); return { width: String(s).length * px * 0.58, actualBoundingBoxAscent: px * 0.7, actualBoundingBoxDescent: px * 0.2 }; };
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return (...a) => { LOG.push(k + '(' + fmt(a) + ')'); return grad(); };
      if (k === 'createPattern') return () => ({});
      if (k === 'getImageData' || k === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h });
      if (k === 'getLineDash') return () => [];
      if (k in t) return t[k];
      return (...a) => { LOG.push(String(k) + '(' + fmt(a) + ')'); };
    },
    set(t, k, v) { LOG.push(String(k) + '=' + (typeof v === 'object' ? 'obj' : v)); t[k] = v; return true; },
  });
}
export const DOC_CALLS = [];
export const fakeDocument = { createElement: (tag) => { DOC_CALLS.push({ tag, stack: new Error().stack.split('\n').slice(2, 5).join(' | ') }); const c = { tagName: tag, width: 300, height: 150, _c: null, getContext() { return this._c || (this._c = ctx(this)); }, toDataURL: () => 'data:' }; return c; } };
