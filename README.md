# AI Trading Bot — MT5 Dashboard (100% free, no VPS, no MetaAPI)

A real-time AI Trading Bot dashboard that replicates the reference UI (dark
theme, green accent, countdown timer, console terminal, live trade log) and
connects to **MetaTrader 5** running on your own Windows PC — with **no paid
services**.

```
┌─────────────────────────── Your Windows PC ───────────────────────────┐
│                                                                        │
│   MetaTrader 5  ──ZeroMQ──►  Local Bridge (Node.js)                    │
│   + Bridge.mq5 EA            (/local-bridge)                           │
│                                    │                                   │
└────────────────────────────────────┼──────────────────────────────────┘
                                      │  Socket.IO (outbound WSS)
                                      ▼
                        Cloud Dashboard + Relay  (free tier)
                              (/dashboard, server.js)
                                      ▲
                                      │  open from phone / laptop, anywhere
                                      ▼
                                  📱  Browser
```

Why this is free:
- **MT5** runs on your own Windows PC (no broker/VPS fee).
- The **local bridge** initiates an outbound WebSocket to the cloud, so there's
  no port forwarding, static IP, or paid tunnel.
- The **dashboard + relay** is one Node process that fits the free tier on
  Railway / Render / Fly.
- No MetaAPI, no paid data feeds.

> ⚠️ Trade-off: your PC must stay on (with MT5 + bridge running) for trading to
> continue. The dashboard itself is reachable from anywhere while the bridge is
> online. If you later want 24/7 without keeping a PC on, you can move MT5 + the
> bridge to a cheap Windows VPS — but that is optional and not required here.

## Repository layout

| Folder            | What it is                                                |
| ----------------- | --------------------------------------------------------- |
| [`dashboard/`](./dashboard)       | Next.js 14 + TS + Tailwind UI **and** the Socket.IO relay (`server.js`) |
| [`local-bridge/`](./local-bridge) | Node.js app you run on Windows next to MT5 (ZeroMQ ↔ cloud) |
| [`mt5-bridge-ea/`](./mt5-bridge-ea) | `Bridge.mq5` Expert Advisor (ZeroMQ PUB/REP)            |

(The older `frontend/` and `backend/` folders are a previous prototype and are
unrelated to this architecture.)

---

## 1. Try the demo in 60 seconds (no MT5 needed)

```bash
# Terminal 1 — dashboard + relay
cd dashboard
cp .env.example .env
npm install
npm run dev            # http://localhost:3000
```

Open <http://localhost:3000>, log in with **admin / admin**, keep the bridge
token **DEMO-1234**. The built-in simulator immediately streams live data so you
can see the exact UI from the video (countdown, terminal, trade log) in action.

Want the data to come from the *bridge* process instead of the dashboard's
built-in simulator? Run:

```bash
# Terminal 2 — local bridge in simulate mode
cd local-bridge
cp .env.example .env
npm install
npm run simulate       # prints a token like BR-XXXX-XXXX
```

Then paste the printed token into the dashboard **Settings → Bridge Connection**.

---

## 2. Connect real MT5 (Windows) — free

### Step A — Install & log in to MT5
1. Install MetaTrader 5 from your broker (Exness / HFM / VT Market /
   Market4You / any MT5 broker).
2. Log in to your trading account.

### Step B — Install the ZeroMQ EA
Follow [`mt5-bridge-ea/README.md`](./mt5-bridge-ea/README.md):
- Install the [mql-zmq](https://github.com/dingmaotu/mql-zmq) library
  (`Include/Zmq`, `Include/Mql`, and `libzmq.dll` + `libsodium.dll` in
  `MQL5/Libraries`).
- Copy `Bridge.mq5` to `MQL5/Experts`, compile (F7).
- Enable **Allow DLL imports** + **Algo Trading**, attach the EA to your symbol
  chart. It keeps `InpDryRun = true` (no real orders) until you opt in.

### Step C — Run the local bridge
```bash
cd local-bridge
cp .env.example .env
# edit .env: set CLOUD_URL to your deployed dashboard, MODE=mt5
npm install
npm start              # prints your connection token
```

### Step D — Connect the dashboard
Open your deployed dashboard, log in, go to **Settings → Bridge Connection**,
paste the bridge token, **Save & Reconnect**. Live MT5 data now appears.

---

## 3. Deploy the dashboard for free

The relay needs persistent WebSockets, so use **Railway** or **Render** (both
free tier). Full steps in [`dashboard/README.md`](./dashboard/README.md).

- **Railway:** New Project → Deploy from repo → root dir `dashboard`
  (picks up `railway.json`). Add env vars from `.env.example`.
- **Render:** New → Blueprint → `dashboard/render.yaml`.

> **Vercel:** serverless functions can't hold a long-lived WebSocket server, so
> host the relay on Railway/Render. You *may* host only the frontend on Vercel
> and point it at the relay via `NEXT_PUBLIC_RELAY_URL`. Easiest is to deploy the
> whole thing to Railway/Render.

---

## 4. Multi-broker support

The EA reads from your **local MT5 terminal**, so it automatically works with
any MT5 broker. Just log into MT5 with your broker and set `InpSymbol` to match
your broker's exact symbol (some add suffixes like `XAUUSD.m`). No code changes.

---

## 5. Security

- MT5 password is **never** sent anywhere — it stays in your local MT5 terminal.
- The dashboard login uses a JWT signed with `JWT_SECRET` (set a strong value).
- Use **WSS/HTTPS** in production (Railway/Render provide TLS automatically).
- The connection token pairs a bridge with a dashboard; treat it like a secret.
- `InpDryRun = true` by default so the EA can't place real orders accidentally.

---

## 6. Troubleshooting & FAQ

**Dashboard shows "Connecting to bridge…" forever.**
Make sure the relay is running (the dashboard's own `server.js`), and that the
token in Settings matches the bridge's printed token. For a quick check, use
token `DEMO-1234` with `SIMULATE=true`.

**Bridge logs `connect error` repeatedly.**
`CLOUD_URL` is wrong or the relay isn't reachable. Verify the URL in a browser.
The bridge auto-reconnects with exponential backoff, so fix the URL and it
recovers on its own.

**EA won't compile / `Cannot open Zmq/Zmq.mqh`.**
The mql-zmq library isn't installed. Re-check Step B — the `Include/Zmq` and
`Include/Mql` folders must be under `MQL5/Include`, and the DLLs under
`MQL5/Libraries`.

**EA compiles but no data appears.**
Enable *Allow DLL imports* (Options → Expert Advisors **and** the EA's Common
tab) and turn on **Algo Trading**. Confirm the Experts log shows
`Bridge EA initialised`.

**Symbol not trading.**
Your broker's symbol name probably has a suffix. Set `InpSymbol` to the exact
name shown in MT5 Market Watch.

**Can I run it 24/7 without my PC on?**
Not in the free setup — your PC (with MT5 + bridge) must stay on. Optionally
move MT5 + the bridge to a low-cost Windows VPS later; nothing in the code
needs to change.

**Is it really free?** Yes — MT5 (free from broker), the local bridge (runs on
your PC), and the dashboard (free tier on Railway/Render). No MetaAPI, no paid
feeds.
