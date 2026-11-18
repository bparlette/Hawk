// lf_net.js — task L6, the client side of THE ONE WORLD (server/server.js). play.html?server=wss://<host>&key=<invite key>
// Your crew member is simulated HERE on Palm City physics (instant controls, no lag on your own car) and reported at
// 15 Hz; every other crew member — CPU or another friend — is drawn from the server's 10 Hz snapshots, 120 ms in the
// past and interpolated, so they glide instead of stepping. Friends only, so your machine is trusted for your own car.
// M-D: a friend ON FOOT rides their car report (f = [x, y, h]) and comes back in the snap's w list — walkerMap holds
// them, eased, for lf_fx to draw. The rally's arrival beat rides m.rally.beat (main.js plays it with lf_mission.stepBeat).
export class Net {
  constructor(url, key) {
    this.crew = []; this.snaps = []; this.me = null; this.onYou = null; this.status = 'connecting'; this.sendT = 0;
    this.walks = []; this.walkerMap = new Map();   // M-D: friends on foot (snap w) — eased toward their last reported spot in frame()
    this.ws = new WebSocket(url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key));
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'hello') { this.crew = m.crew; this.status = 'online'; }
      else if (m.type === 'taken') { this.crew = m.crew; this.status = m.id.toUpperCase() + ' IS TAKEN'; }
      else if (m.type === 'you') { this.me = m.id; this.status = 'online'; if (this.onYou) this.onYou(m.id, m.state); }
      else if (m.type === 'snap') {
        this.rally = m.rally || null; this.walks = m.w || [];
        this.snaps.push({ at: performance.now(), cars: new Map(m.cars.map(c => [c[0], c])) }); if (this.snaps.length > 8) this.snaps.shift();
        for (const c of m.cars) { const p = this.crew.find(q => q.id === c[0]); if (p) p.human = c[7] || null; }
      }
    };
    this.ws.onclose = (e) => { this.status = e.code === 4003 ? 'NOT ON THE FRIENDS LIST' : 'OFFLINE'; };
  }
  takenBy(id) { const p = this.crew.find(q => q.id === id); return p && p.human && id !== this.me ? p.human : null; }
  pick(id) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'pick', id })); }
  // every frame: report my car (15 Hz — with my on-foot state riding it, M-D), place everyone else from the snapshots
  frame(sim, dt, foot) {
    const P = sim.player;
    if (this.me && P && (this.sendT -= dt) <= 0 && this.ws.readyState === 1) { this.sendT = 1 / 15; const rep = { type: 'car', x: P.x, y: P.y, h: P.h, v: P.v, z: P.z || 0, vz: P.vz || 0, layer: P.layer }; if (foot) rep.f = [Math.round(foot.x), Math.round(foot.y), +foot.h.toFixed(3)]; this.ws.send(JSON.stringify(rep)); }
    const S = this.snaps; if (!S.length) return;
    const t = performance.now() - 120; let a = S[0], b = S[S.length - 1];
    for (let i = 0; i + 1 < S.length; i++) if (S[i].at <= t && S[i + 1].at >= t) { a = S[i]; b = S[i + 1]; break; }
    const u = b.at > a.at ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))) : 1;
    for (const c of sim.cars) {
      if (c === P) continue; const A = a.cars.get(c.owner), B = b.cars.get(c.owner); if (!A || !B) continue;
      let dh = B[3] - A[3]; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      c.remote = true; c.parked = Math.abs(B[4]) < 2; c.x = A[1] + (B[1] - A[1]) * u; c.y = A[2] + (B[2] - A[2]) * u; c.h = A[3] + dh * u;
      c.v = B[4]; c.z = A[5] + (B[5] - A[5]) * u; c.layer = B[6]; c.human = B[7] || null; c.inside = B[8] ? B[8][0] : null;   // L7: [8] = [house id, floor, x] while that CPU idles inside their house
    }
    // M-D: friends on foot — ease each remote walker toward its last reported spot (drawn by lf_fx via setWalkers)
    const seen = new Set();
    for (const w of this.walks) {
      if (w[0] === this.me) continue;                       // your own walker is drawn locally (lf_foot), never from the wire
      seen.add(w[0]);
      let f = this.walkerMap.get(w[0]);
      if (!f) { f = { id: w[0], x: w[1], y: w[2], tx: w[1], ty: w[2], px: w[1], py: w[2], h: w[3] }; this.walkerMap.set(w[0], f); }
      f.tx = w[1]; f.ty = w[2]; f.h = w[3];
    }
    for (const [id, f] of this.walkerMap) {
      if (!seen.has(id)) { this.walkerMap.delete(id); continue; }
      f.px = f.x; f.py = f.y;
      const k = Math.min(1, dt * 9); f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k;
    }
  }
}
