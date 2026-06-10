# MT5 Bridge EA (`/mt5-bridge-ea`)

`Bridge.mq5` is an MQL5 Expert Advisor that exposes your MetaTrader 5 terminal
to the local bridge over **ZeroMQ**:

- **PUB** socket `tcp://*:5556` — streams `account`, `stats`, `bot`, `trade`,
  and `log` messages.
- **REP** socket `tcp://*:5557` — accepts commands: `pause`, `resume`, `stop`,
  `buy`, `sell`, `close`.

The Node.js [`../local-bridge`](../local-bridge) connects to these sockets and
relays everything to the cloud dashboard.

> ⚠️ **Safety:** the EA ships with `InpDryRun = true`, so it does **not** place
> real orders by default — it simulates PnL so you can wire everything up
> safely. Set `InpDryRun = false` only when you understand the risk and want
> the bot to trade your live/demo account.

## Prerequisites: the mql-zmq library

`Bridge.mq5` uses the open-source **mql-zmq** binding:
<https://github.com/dingmaotu/mql-zmq>

1. Download the repo (Code → Download ZIP) and unzip it.
2. In MetaTrader 5: **File → Open Data Folder**, then open `MQL5`.
3. Copy the library files:
   - `Include/Zmq`  → `MQL5/Include/Zmq`
   - `Include/Mql`  → `MQL5/Include/Mql`
   - From `Library/MT5` copy **`libzmq.dll`** and **`libsodium.dll`**
     → `MQL5/Libraries`
     (use the 64-bit DLLs — modern MT5 is 64-bit).

## Install the EA

1. Copy `Bridge.mq5` → `MQL5/Experts/Bridge.mq5`.
2. In MetaTrader 5 open **MetaEditor** (F4), open `Bridge.mq5`, and press
   **Compile** (F7). It should compile with 0 errors.
3. Back in MT5, enable algo trading: **Tools → Options → Expert Advisors →**
   check *Allow DLL imports*, and click the **Algo Trading** toolbar button.
4. Open a chart for your symbol (e.g. **XAUUSD**) and drag **Bridge** onto it.
5. In the EA dialog → **Common** tab, check *Allow DLL imports*. On the
   **Inputs** tab set your symbol / lot / interval. Click **OK**.
6. You should see `Bridge EA initialised. PUB=tcp://*:5556 REP=tcp://*:5557` in
   the **Experts** log.

## Inputs

| Input              | Default        | Meaning                                  |
| ------------------ | -------------- | ---------------------------------------- |
| `InpBotName`       | Pro Trading Bot| Display name shown in dashboard          |
| `InpBotVersion`    | v2.1           | Version label                            |
| `InpBotMode`       | balanced       | balanced / aggressive / conservative     |
| `InpSymbol`        | XAUUSD         | Symbol to trade                          |
| `InpLot`           | 0.01           | Lot size per trade                       |
| `InpIntervalSec`   | 60             | Seconds between trade cycles (countdown) |
| `InpHoldSeconds`   | 8              | How long to hold each position           |
| `InpFastMA`/`InpSlowMA` | 10 / 30   | EMA periods for the entry signal         |
| `InpDryRun`        | true           | **true = no real orders (safe)**         |
| `InpMagic`         | 990201         | Magic number for this EA's trades        |
| `InpPubAddress`    | tcp://*:5556   | ZeroMQ PUB bind address                  |
| `InpRepAddress`    | tcp://*:5557   | ZeroMQ REP bind address                  |
| `InpPublishMs`     | 1000           | Publish/poll interval (ms)               |

## Message formats

PUB (EA → bridge), one JSON object per frame:

```jsonc
{"type":"account","balance":3712.91,"equity":3712.91,"currency":"USD"}
{"type":"stats","totalTrades":13,"wins":11,"losses":2,"winRate":84.6,"profit":584.88}
{"type":"bot","name":"Pro Trading Bot","version":"v2.1","mode":"balanced",
 "status":"running","symbol":"XAUUSD","displaySymbol":"XAU/USD","perTrade":5000,
 "intervalSeconds":60,"nextTradeSeconds":41}
{"type":"trade","ticket":123,"symbol":"XAUUSD","displaySymbol":"XAU/USD",
 "direction":"buy","price":1.08,"profit":55.00}
{"type":"log","level":"profit","text":"✓ Profit: +$55.00","time":"08:58:46"}
```

REP (bridge → EA) commands:

```jsonc
{"cmd":"pause"}   {"cmd":"resume"}  {"cmd":"stop"}
{"cmd":"buy"}     {"cmd":"sell"}    {"cmd":"close"}
```

## Multi-broker

Because the EA talks to the **local MT5 terminal**, it works with any MT5
broker (Exness, HFM, VT Market, Market4You, …). Just log into MT5 with your
broker and attach the EA — no code changes needed. Symbol names sometimes carry
a suffix (e.g. `XAUUSD.m`, `XAUUSDm`); set `InpSymbol` to match exactly what
your broker's Market Watch shows.
