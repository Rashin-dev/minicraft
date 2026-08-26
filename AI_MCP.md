# 🤖 MiniCraft MCP Bridge Protocol

Drive a live MiniCraft world from any external AI agent (Claude, GPT, a local LLM, an MCP server…) over **WebSocket + JSON-RPC 2.0**.

The **game is the client**: it connects out to your bridge URL (so no port-forwarding into the browser is needed). Your server can then call methods on the game at any time.

## Connecting

In-game: **Pause menu → AI Architect → connect AI → MCP bridge** → enter `ws://localhost:8787` → **Connect**.
The game auto-reconnects every 3 s if the socket drops.

## Wire format

Standard JSON-RPC 2.0, one object per WebSocket text frame.

**Requests from your server → game:**

```json
{ "jsonrpc": "2.0", "id": 1, "method": "build", "params": { "plan": { ... } } }
```

**Game → your server:**

```json
{ "jsonrpc": "2.0", "id": 1, "result": "ok" }
{ "jsonrpc": "2.0", "method": "game/ready", "params": { "pos": [8, 40, 8], ... } }
```

## Methods

| Method | Params | Effect |
|---|---|---|
| `getState` | — | Returns `{ pos:[x,y,z], time:0..1, weather, fps, seed }` |
| `setBlock` | `x, y, z, block` | Place/remove one block (`block` = name or numeric id, `0` = air) |
| `build` | `plan` | Execute a validated build plan (schema below) |
| `chat` / `command` | `text` | Run as if typed in chat: `"/time day"`, `"build a palace"`, … |
| `teleport` | `x, y, z` | Teleport the player |
| `setTime` | `time` | `0..1` (0.3 = morning, 0.8 = night) or `"day"` / `"night"` |

Notifications from the game: `game/ready` (on connect, with state).

## Build plan schema

```jsonc
{
  "name": "Seaside Palace",
  "ops": [
    { "op": "fill",   "from": [-10, 0, -10], "x2": 10, "y2": 0, "z2": 10, "block": "sandstone" },
    { "op": "wall",   "from": [-10, 1, -10], "x2": 10, "y2": 8, "z2": 10, "block": "stone_bricks" },
    { "op": "cylinder", "x": 0, "y": 1, "z": 0, "r": 3, "h": 6, "block": "log" },
    { "op": "sphere", "x": 0, "y": 10, "z": 0, "r": 5, "block": "glass", "hollow": true },
    { "op": "clear",  "from": [-1, 1, -10], "x2": 1, "y2": 3, "z2": -10 },
    { "op": "set",    "x": 0, "y": 1, "z": 0, "block": "lantern" },
    { "op": "tree",   "x": 6, "z": 6, "kind": "cherry" }
  ]
}
```

Coordinates are **relative to the build anchor** (8 blocks in front of the player, ground-snapped). All plans pass through `sanitizePlan`: coordinates clamped to ±64/±40, total volume capped at ~12 000 blocks. Block names: see `NAME_TO_ID` in `src/game/aiBridge.ts` (`grass`, `stone_bricks`, `cherry_leaves`, `glowstone`, `lantern`, …).

## Minimal bridge server (Node)

```js
// mcp-bridge.mjs — node mcp-bridge.mjs
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8787 });
wss.on('connection', (ws) => {
  console.log('MiniCraft connected');
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'getState', params: {} }));
  // Example: build a small tower as soon as the game joins
  ws.on('message', (d) => console.log('game:', d.toString().slice(0, 200)));
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chat',
    params: { text: 'build a tower' } }));
});
console.log('MCP bridge on ws://localhost:8787');
```

Wire it to a real MCP server by exposing these methods as MCP tools — each tool handler forwards to the WebSocket. Example tool set: `get_state`, `set_block`, `build`, `command`, `teleport`, `set_time`.

## Security notes

- Only connect the bridge to servers you trust — they gain full control of the world.
- Plans are clamped, but `command` can run any chat command (including `/gamemode`).
- Your remote-AI API key is stored in `localStorage` on the device only; it is sent solely to the endpoint you configure.
