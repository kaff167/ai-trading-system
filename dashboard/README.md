# Cloud Dashboard (`/dashboard`)

Next.js 14 + TypeScript + Tailwind dashboard that replicates the reference video
UI, plus a built-in **Socket.IO relay** so the local bridge and the browser can
talk in real time without port forwarding or a static IP.

```
[ Local Bridge (Windows PC + MT5) ] --socket.io--> [ this server ] <--socket.io-- [ Browser ]
```

A single Node process (`server.js`) serves the Next.js app **and** runs the
relay, so you deploy one service to a host that supports persistent WebSockets
(Railway / Render / Fly free tier).

## Run locally

```bash
cd dashboard
cp .env.example .env       # adjust if you like
npm install
npm run dev                # http://localhost:3000
```

Log in with `admin / admin` and the bridge token `DEMO-1234`. With
`SIMULATE=true` the dashboard immediately shows realistic, live simulated bot
data (countdown, console terminal, trade log) — no MT5 required.

## Scripts

| Script           | Description                                  |
| ---------------- | -------------------------------------------- |
| `npm run dev`    | Start Next.js + relay (dev)                  |
| `npm run build`  | Production build                             |
| `npm start`      | Start production server (`node server.js`)   |
| `npm run lint`   | ESLint                                       |
| `npm run typecheck` | `tsc --noEmit`                            |

## Environment variables

See [`.env.example`](./.env.example). Key ones:

- `JWT_SECRET` — sign login tokens (set a long random value in production)
- `DASHBOARD_USER` / `DASHBOARD_PASSWORD` — simple built-in login
- `SIMULATE` — `true` to enable the built-in demo simulator
- `DEMO_TOKEN` — token that triggers the simulator (default `DEMO-1234`)
- `SIM_INTERVAL_SECONDS` — seconds between simulated trades (default `15`)

## Deploy (free)

### Railway / Render (recommended — supports WebSockets)

- **Railway:** New Project → Deploy from repo → set root directory to
  `dashboard` → it picks up `railway.json`. Add env vars from `.env.example`.
- **Render:** New → Blueprint → point at `dashboard/render.yaml`, or create a
  Web Service with build `npm install && npm run build` and start `node server.js`.

### Vercel note

Vercel's serverless functions **cannot hold a persistent WebSocket server**, so
the relay (`server.js`) must run on Railway/Render/Fly. You can still host the
*frontend* on Vercel and point it at the relay by setting
`NEXT_PUBLIC_RELAY_URL=https://your-relay.up.railway.app`. The simplest path is
to deploy the whole thing to Railway/Render.

## Realtime protocol

Events (Socket.IO):

| From       | Event                  | Payload                                  |
| ---------- | ---------------------- | ---------------------------------------- |
| Bridge     | `bridge:register`      | `{ token }`                              |
| Bridge     | `state`                | full `BotState` snapshot                 |
| Bridge     | `trade`                | one closed `Trade`                       |
| Bridge     | `log`                  | one console `LogLine`                    |
| Dashboard  | `dashboard:subscribe`  | `{ token }`                              |
| Dashboard  | `dashboard:command`    | `{ action: start\|pause\|resume\|stop }` |
| Relay→Bridge | `command`            | `{ action, payload }`                    |

See [`src/lib/types.ts`](./src/lib/types.ts) for payload shapes.
