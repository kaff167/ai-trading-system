# Local Bridge (`/local-bridge`)

A small Node.js app the user runs on their **Windows PC** next to MetaTrader 5.
It reads live data from MT5 (via the ZeroMQ EA) and streams it to the cloud
dashboard over a Socket.IO WebSocket connection — no VPS, no port forwarding,
no static IP required. The bridge *initiates* the connection outward to the
cloud, so it works behind any home router.

## Quick start (testing without MT5)

```bash
cd local-bridge
cp .env.example .env
npm install
npm run simulate          # or: node bridge.js --simulate
```

The bridge prints a **connection token** (e.g. `BR-9F3A-21C7`). Open the
dashboard, go to **Settings → Bridge Connection**, paste the token, and you'll
see live simulated data flow from the bridge to the dashboard.

## Production (with MT5)

1. Install MetaTrader 5 and log in to your broker account (Exness, HFM,
   VT Market, Market4You, …).
2. Install the ZeroMQ EA — see [`../mt5-bridge-ea/README.md`](../mt5-bridge-ea/README.md).
3. Set `CLOUD_URL` in `.env` to your deployed dashboard
   (e.g. `https://your-app.up.railway.app`) and `MODE=mt5`.
4. Run the bridge:

   ```bash
   npm install
   npm start                 # node bridge.js
   ```

5. Paste the printed token into the dashboard Settings screen.

## Build a Windows `.exe` (optional, for non-technical users)

```bash
npm install
npm run build:exe           # produces dist/mt5-bridge.exe (via pkg)
```

Ship `dist/mt5-bridge.exe` + a `.env` file. Users just double-click the exe.

> Note: the native `zeromq` addon is not bundled by `pkg`. For MT5 mode in a
> packaged build, keep `node_modules/zeromq` next to the exe, or distribute the
> folder with `npm install` instead. Simulate mode works standalone.

## How it works

```
 MetaTrader 5  ──ZeroMQ──►  Local Bridge  ──Socket.IO──►  Cloud Relay  ──►  Dashboard
   (Bridge.mq5 EA)            (this app)                  (server.js)        (browser)
        ▲                                                                       │
        └───────────────────────  commands (pause/stop/buy/sell)  ◄────────────┘
```

| File                  | Responsibility                                        |
| --------------------- | ----------------------------------------------------- |
| `bridge.js`           | Entry point, wiring, token banner, graceful shutdown  |
| `config.js`           | Env config + persistent token (`.bridge-token`)       |
| `websocket-client.js` | Socket.IO client, register, heartbeat, auto-reconnect |
| `mt5-connector.js`    | ZeroMQ SUB/REQ to the EA → `state`/`trade`/`log`       |
| `simulator.js`        | Demo data generator for `--simulate`                  |

## Environment variables

See [`.env.example`](./.env.example): `CLOUD_URL`, `BRIDGE_TOKEN`, `MODE`,
`ZMQ_SUB_ADDR`, `ZMQ_REQ_ADDR`, `HEARTBEAT_MS`.
