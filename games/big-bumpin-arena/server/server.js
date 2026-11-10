import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server, Room } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const Matter = require(path.join(__dirname, '../vendor/matter.min.js'));
const { Game } = await import(path.join(__dirname, '../src/game.js'));
const { HZ } = await import(path.join(__dirname, '../src/config.js'));
const { exportSnapshot } = await import(path.join(__dirname, '../src/net.js'));

export class ArenaRoom extends Room {
  onCreate(options) {
    this.maxClients = 4;
    this.roomCode = options.roomCode || 'GAME';
    this.setMetadata({ roomCode: this.roomCode });

    const seed = options.seed || Math.floor(Math.random() * 100000) + 1;
    this.matchOpts = {
      seed,
      arena: options.arena || 'rink',
      surface: options.surface || 'asphalt',
      hazards: options.hazards || { pads: false, pylons: false, tilt: false }
    };

    this.game = new Game(Matter, this.matchOpts);
    this.clientsBySeat = new Map(); // seatIndex -> client
    this.seatsByClient = new Map(); // clientId -> seatIndex
    this.pendingInputs = {};        // seatIndex -> input

    this.onMessage('input', (client, message) => {
      const seat = this.seatsByClient.get(client.sessionId);
      if (seat !== undefined && message) {
        this.pendingInputs[seat] = message;
      }
    });

    // 60 Hz simulation loop
    this.setSimulationInterval(() => this.updateSim(), 1000 / HZ);
  }

  onJoin(client, options) {
    // Assign first open seat (0..3)
    let seat = -1;
    for (let i = 0; i < 4; i++) {
      if (!this.clientsBySeat.has(i)) {
        seat = i;
        break;
      }
    }
    if (seat === -1) {
      client.leave();
      return;
    }

    this.clientsBySeat.set(seat, client);
    this.seatsByClient.set(client.sessionId, seat);

    console.log(`Client ${client.sessionId} joined seat ${seat} in room ${this.roomCode}`);

    // Send init packet
    client.send('init', {
      seat,
      roomCode: this.roomCode,
      opts: this.matchOpts,
      snapshot: exportSnapshot(this.game)
    });

    // Notify all of seat updates
    this.broadcast('seats', Array.from(this.clientsBySeat.keys()));
  }

  onLeave(client) {
    const seat = this.seatsByClient.get(client.sessionId);
    if (seat !== undefined) {
      this.clientsBySeat.delete(seat);
      this.seatsByClient.delete(client.sessionId);
      delete this.pendingInputs[seat];
      console.log(`Client ${client.sessionId} left seat ${seat} in room ${this.roomCode}`);
      this.broadcast('seats', Array.from(this.clientsBySeat.keys()));
    }
  }

  updateSim() {
    // Bots backfill empty seats automatically via Game.tick()
    // Humans provide pendingInputs
    const humans = {};
    for (const [seat, inp] of Object.entries(this.pendingInputs)) {
      humans[seat] = inp;
    }

    this.game.tick(humans);

    // Broadcast snapshot + digest every tick (or 20Hz-60Hz)
    // Sending snapshot every tick ensures soak determinism and instant resync verification
    const snap = exportSnapshot(this.game);
    this.broadcast('snapshot', snap);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 2567;
const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define('arena', ArenaRoom);

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    console.log(`Big Bumpin Arena Server listening on ws://localhost:${port}`);
  });
}

export { server, gameServer };
