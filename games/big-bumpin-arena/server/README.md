# Big Bumpin' Arena — Friends Multiplayer Server

A lightweight Colyseus server powering private 4-letter room multiplayer for Big Bumpin' Arena.

## Architecture
- **Host-Authoritative:** The server runs the authoritative simulation (`src/game.js`, `src/world.js`, Matter.js) at 60 Hz.
- **Client Prediction & Reconciliation:** Local clients predict their assigned car and reconcile against server snapshots.
- **State Digest & Desync Detection:** The client detects digest discrepancies and instantly resyncs state from host snapshots.
- **Bot Backfilling:** Unoccupied seats are driven by the bot AI. When a player joins, the bot for that seat yields gracefully.

## Getting Started

1. Navigate to this directory:
   ```bash
   cd games/big-bumpin-arena/server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
The server listens on `ws://localhost:2567` by default.

## Client Configuration
Set the server URL in client settings or via URL query parameter:
```
?server=ws://localhost:2567&room=ABCD
```
Local play, gamepad P2, and spectate mode remain 100% functional with no server running.
