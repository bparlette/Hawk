// minimal canvas stub: records every 2D call so the fur drawing can be hashed for determinism
export const CANVAS_LOG = [];
function ctx() {
  return new Proxy({}, { get(t, k) { if (k in t) return t[k]; return (...a) => { CANVAS_LOG.push(k + '(' + a.map((x) => typeof x === 'number' ? x.toFixed(4) : typeof x === 'object' ? 'obj' : String(x)).join(',') + ')'); }; },
    set(t, k, v) { CANVAS_LOG.push(k + '=' + v); t[k] = v; return true; } });
}
export const fakeDocument = { createElement: () => { const c = { width: 0, height: 0, _ctx: null, getContext() { return this._ctx || (this._ctx = ctx()); } }; return c; } };
