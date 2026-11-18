# Laurel/Fulton — THE ONE WORLD (task L6)

There is one persistent world, and only friends can join it.
- The server (`server.js` plus `../src/lf_world.js`) runs the real game simulation all the time.
- Every crew member lives in the world as a CPU, until a friend picks them.

## Friends only: the scheme
- **Invite keys.** Each friend gets one random key. The list lives on the server only:
  - in the `FRIENDS` env var, `key1:Name,key2:Name`;
  - or in `friends.local.json`, which is git-ignored.
- **Invite link.** Each friend's link is `https://<pages>/games/laurel-fulton/play.html?server=wss://<host>&key=<their key>`.
- **No valid key, no world.** A missing or unknown key gets the socket closed (code 4003) before anything about the world is sent.
- **Adding or removing a friend** means editing that list and restarting the server.
- **No sign-up.** There is no sign-up page, lobby, server list or matchmaking.
- **Trust.** Each friend's own machine simulates their car and reports it. That keeps their controls instant. It is safe because only friends are on the list. The server stays authoritative for every CPU.

## Hosting and cost
This follows the household precedent: a Render web service.
- **Render Starter: $7/month.** It is always on.
  - Do NOT use Render's free tier. It sleeps after 15 minutes idle, and the world must never stop.
  - Start command: `cd games/laurel-fulton/server && npm install && npm start`.
  - Set `FRIENDS` in the Render dashboard.
  - The port comes from `PORT`.
- **Cheaper alternative:** Fly.io, shared-cpu-1x 256 MB, about $2–3/month.
- **Load:** the world uses well under 5% of one CPU, and about 1 KB per snapshot per friend at 10 Hz.
- **The page itself** stays on GitHub Pages (free) and connects out to the server.

## Run locally
- **Server:** `npm install && FRIENDS="k1:Friend A" npm start`. It listens on :2580.
- **Page:** open `play.html?server=ws://localhost:2580&key=k1`.

## Proof
- `node tools/spec_l6.mjs` checks the world and the real sockets.
- `CHROME=… node tools/l6_shots.mjs` runs two real browsers as two friends, using taps and keys. It writes `shots/l6-*.png`.
