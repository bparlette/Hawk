// server.js — task L6: THE ONE WORLD. One process, always running, always the same world; friends only.
//   cd games/laurel-fulton/server && npm install && FRIENDS="key1:Brian,key2:Matt" npm start      (PORT, default 2580)
// FRIENDS-ONLY = a closed allowlist of invite keys (env FRIENDS, or a git-ignored friends.local.json {"<key>": "<name>"}).
// Each friend gets ONE link: play.html?server=wss://<host>&key=<their key>. No key / unknown key -> the socket is closed
// (4003) before anything about the world is sent. There is no sign-up, no listing, no lobby: the list IS the access.
//
// The world (src/lf_world.js) steps at 30 Hz whether or not anyone is connected. Everyone is CPU until picked.
// Protocol (JSON over one WebSocket):
//   S->C hello {crew:[{id,name,human}], t}        C->S pick {id}          S->C you {id, state} | taken {id}
//   C->S car {x,y,h,v,z,vz,layer} (~15 Hz, the picker's machine is authoritative for its own car — friends only, so trusted)
//   S->C snap {t, cars:[[id,x,y,h,v,z,layer,human]...]} at 10 Hz          C->S leave {} | socket close -> the CPU takes back over
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
const HERE = path.dirname(fileURLToPath(import.meta.url));

export function friendsFrom(env = process.env.FRIENDS, file = path.join(HERE, 'friends.local.json')) {
  const F = new Map();
  if (fs.existsSync(file)) for (const [k, n] of Object.entries(JSON.parse(fs.readFileSync(file)))) F.set(k, n);
  for (const pair of (env || '').split(',').filter(Boolean)) { const [k, n] = pair.split(':'); F.set(k.trim(), (n || k).trim()); }
  return F;
}

export async function start({ port = Number(process.env.PORT) || 2580, friends = friendsFrom(), root = path.resolve(HERE, '..'), hz = 30, log = console.log } = {}) {
  const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f)));
  const src = (f) => pathToFileURL(path.join(HERE, '..', 'src', f)).href;
  const { GraphWorld } = await import(src('world_graph.js')); const { CrewWorld } = await import(src('lf_world.js'));
  const bumps = fs.existsSync(path.join(root, 'data/bumps.json')) ? J('data/bumps.json').bumps : [];
  const WD = new CrewWorld(new GraphWorld(J('data/graph.json')), J('data/roster.json'), J('assets/fleet.json'), { bumps });
  const wss = new WebSocketServer({ port });
  const seats = new Map();                                  // socket -> crew id it drives
  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const free = (ws) => { const id = seats.get(ws); if (id) { WD.release(id); seats.delete(ws); log(`[world] ${id} back to the CPU`); } };
  wss.on('connection', (ws, req) => {
    const key = new URL(req.url, 'http://x').searchParams.get('key'), name = friends.get(key);
    if (!name) { ws.close(4003, 'friends only'); return; }
    ws.friend = name; log(`[world] ${name} connected`);
    send(ws, { type: 'hello', crew: WD.who(), t: WD.S.time });
    ws.on('message', (buf) => {
      let m; try { m = JSON.parse(buf); } catch { return; }
      if (m.type === 'pick') {
        free(ws);
        const st = WD.takeover(m.id, name);
        if (st) { seats.set(ws, m.id); send(ws, { type: 'you', id: m.id, state: st }); log(`[world] ${name} took over ${m.id}`); }
        else send(ws, { type: 'taken', id: m.id, crew: WD.who() });
      } else if (m.type === 'car' && seats.has(ws)) WD.drive(seats.get(ws), m);
      else if (m.type === 'leave') free(ws);
    });
    ws.on('close', () => { free(ws); log(`[world] ${name} left`); });
  });
  const dt = 1 / hz;
  const tick = setInterval(() => WD.step(dt), 1000 / hz);
  let n = 0; const snap = setInterval(() => { const m = JSON.stringify({ type: 'snap', t: WD.S.time, cars: WD.snapshot() }); n++; for (const ws of wss.clients) if (ws.friend && ws.readyState === 1) ws.send(m); }, 100);
  await new Promise(r => wss.on('listening', r));
  log(`[world] Laurel/Fulton world up on :${wss.address().port} — ${WD.crew.size} crew (all CPU), ${friends.size} friends on the list`);
  return { WD, wss, port: wss.address().port, close: () => { clearInterval(tick); clearInterval(snap); for (const c of wss.clients) c.terminate(); return new Promise(r => wss.close(r)); } };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) start();
