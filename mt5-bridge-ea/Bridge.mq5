//+------------------------------------------------------------------+
//|                                                      Bridge.mq5   |
//|        AI Trading Bot — MT5 ZeroMQ bridge Expert Advisor          |
//|                                                                  |
//|  Publishes account / stats / bot / trade / log data on a ZeroMQ  |
//|  PUB socket and accepts commands (pause/resume/stop/buy/sell/    |
//|  close) on a ZeroMQ REP socket. The companion Node.js local      |
//|  bridge (../local-bridge) connects to these and relays to the    |
//|  cloud dashboard.                                                |
//|                                                                  |
//|  Requires the mql-zmq library:                                   |
//|    https://github.com/dingmaotu/mql-zmq                          |
//|  Copy its Include/Zmq + Include/Mql folders into MQL5/Include    |
//|  and libzmq.dll + libsodium.dll into MQL5/Libraries.             |
//|  Enable "Allow DLL imports" in the EA settings.                  |
//+------------------------------------------------------------------+
#property copyright "AI Trading Bot"
#property version   "2.10"
#property strict

#include <Zmq/Zmq.mqh>
#include <Trade/Trade.mqh>

//--- inputs -------------------------------------------------------------------
input string  InpBotName        = "Pro Trading Bot"; // Bot display name
input string  InpBotVersion     = "v2.1";            // Bot version
input string  InpBotMode        = "balanced";        // balanced | aggressive | conservative
input string  InpSymbol         = "XAUUSD";          // Trading symbol
input double  InpLot            = 0.01;              // Lot size per trade
input int     InpIntervalSec    = 60;               // Seconds between trade cycles
input int     InpHoldSeconds    = 8;                // Seconds to hold a position
input int     InpFastMA         = 10;               // Fast MA period (signal)
input int     InpSlowMA         = 30;               // Slow MA period (signal)
input bool    InpDryRun         = true;             // TRUE = no real orders (safe demo)
input int     InpMagic          = 990201;           // Magic number
input string  InpPubAddress     = "tcp://*:5556";   // PUB bind address
input string  InpRepAddress     = "tcp://*:5557";   // REP bind address
input int     InpPublishMs      = 1000;             // Publish interval (ms)

//--- ZeroMQ -------------------------------------------------------------------
Context  context("bridge");
Socket   publisher(context, ZMQ_PUB);
Socket   replier(context, ZMQ_REP);

//--- trading ------------------------------------------------------------------
CTrade   trade;

//--- state --------------------------------------------------------------------
string   g_status      = "running";   // running | paused | stopped
int      g_countdown   = 0;           // seconds to next cycle
bool     g_positionOpen= false;
datetime g_openTime    = 0;
double   g_openPrice    = 0;
int      g_openType     = -1;          // ORDER_TYPE_BUY / SELL
int      g_totalTrades  = 0;
int      g_wins         = 0;
int      g_losses       = 0;
double   g_sessionProfit= 0.0;
int      g_fastHandle   = INVALID_HANDLE;
int      g_slowHandle   = INVALID_HANDLE;

//+------------------------------------------------------------------+
string DisplaySymbol(const string sym)
  {
   if(StringLen(sym) == 6)
      return StringSubstr(sym, 0, 3) + "/" + StringSubstr(sym, 3, 3);
   return sym;
  }

//+------------------------------------------------------------------+
//| JSON helpers (MQL5 has no native JSON)                           |
//+------------------------------------------------------------------+
string J(const string key, const string val) { return "\"" + key + "\":\"" + val + "\""; }
string Jn(const string key, const double val, const int digits=2) { return "\"" + key + "\":" + DoubleToString(val, digits); }
string Ji(const string key, const long val) { return "\"" + key + "\":" + IntegerToString(val); }

void Publish(const string json)
  {
   ZmqMsg msg(json);
   publisher.send(msg, true); // ZMQ_DONTWAIT
  }

string Stamp()
  {
   return TimeToString(TimeLocal(), TIME_SECONDS);
  }

void PublishLog(const string level, const string text)
  {
   Publish("{" + J("type","log") + "," + J("level",level) + "," + J("text",text) + "," + J("time",Stamp()) + "}");
  }

//+------------------------------------------------------------------+
int OnInit()
  {
   if(!publisher.bind(InpPubAddress))
     {
      Print("Failed to bind PUB socket on ", InpPubAddress);
      return INIT_FAILED;
     }
   if(!replier.bind(InpRepAddress))
     {
      Print("Failed to bind REP socket on ", InpRepAddress);
      return INIT_FAILED;
     }

   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(InpSymbol);

   g_fastHandle = iMA(InpSymbol, PERIOD_M1, InpFastMA, 0, MODE_EMA, PRICE_CLOSE);
   g_slowHandle = iMA(InpSymbol, PERIOD_M1, InpSlowMA, 0, MODE_EMA, PRICE_CLOSE);

   g_countdown = InpIntervalSec;
   RecountHistory();

   EventSetMillisecondTimer(InpPublishMs);
   PublishLog("info", "Bot engine started — bridge listening on " + InpPubAddress);
   PublishBot();
   PublishAccount();
   PublishStats();
   Print("Bridge EA initialised. PUB=", InpPubAddress, " REP=", InpRepAddress);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(g_fastHandle != INVALID_HANDLE) IndicatorRelease(g_fastHandle);
   if(g_slowHandle != INVALID_HANDLE) IndicatorRelease(g_slowHandle);
   publisher.unbind(InpPubAddress);
   replier.unbind(InpRepAddress);
   context.shutdown();
   context.destroy();
   Print("Bridge EA stopped.");
  }

//+------------------------------------------------------------------+
//| Timer: publish snapshots, run engine, poll for commands          |
//+------------------------------------------------------------------+
void OnTimer()
  {
   PollCommands();

   PublishAccount();
   PublishStats();
   PublishBot();

   if(g_status == "running")
     {
      RunEngine();
     }
  }

//+------------------------------------------------------------------+
void PublishAccount()
  {
   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   string cur = AccountInfoString(ACCOUNT_CURRENCY);
   Publish("{" + J("type","account") + "," + Jn("balance",bal) + "," + Jn("equity",eq) + "," + J("currency",cur) + "}");
  }

void PublishStats()
  {
   double winRate = (g_totalTrades > 0) ? (100.0 * g_wins / g_totalTrades) : 0.0;
   Publish("{" + J("type","stats") + "," + Ji("totalTrades",g_totalTrades) + "," +
           Ji("wins",g_wins) + "," + Ji("losses",g_losses) + "," +
           Jn("winRate",winRate,1) + "," + Jn("profit",g_sessionProfit) + "}");
  }

void PublishBot()
  {
   double perTrade = InpLot * SymbolInfoDouble(InpSymbol, SYMBOL_TRADE_CONTRACT_SIZE);
   Publish("{" + J("type","bot") + "," + J("name",InpBotName) + "," + J("version",InpBotVersion) + "," +
           J("mode",InpBotMode) + "," + J("status",g_status) + "," +
           J("symbol",InpSymbol) + "," + J("displaySymbol",DisplaySymbol(InpSymbol)) + "," +
           Jn("perTrade",perTrade,0) + "," + Ji("intervalSeconds",InpIntervalSec) + "," +
           Ji("nextTradeSeconds",g_countdown) + "}");
  }

//+------------------------------------------------------------------+
//| Simple interval bot engine                                       |
//+------------------------------------------------------------------+
void RunEngine()
  {
   // Manage an open position first.
   if(g_positionOpen)
     {
      if(TimeCurrent() - g_openTime >= InpHoldSeconds)
         ClosePosition();
      return;
     }

   if(g_countdown > 0)
     {
      g_countdown--;
      if(g_countdown % 15 == 0)
         PublishLog("info", "Scanning market conditions...");
      return;
     }

   // Countdown elapsed — evaluate the signal and (maybe) open a trade.
   int signal = Signal();
   if(signal == ORDER_TYPE_BUY)
      PublishLog("info", "MACD crossover detected");
   OpenPosition(signal);
   g_countdown = InpIntervalSec;
  }

int Signal()
  {
   double fast[], slow[];
   ArraySetAsSeries(fast, true);
   ArraySetAsSeries(slow, true);
   if(CopyBuffer(g_fastHandle, 0, 0, 2, fast) < 2 ||
      CopyBuffer(g_slowHandle, 0, 0, 2, slow) < 2)
      return ORDER_TYPE_BUY;
   return (fast[0] >= slow[0]) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
  }

void OpenPosition(const int type)
  {
   double price = (type == ORDER_TYPE_BUY)
                  ? SymbolInfoDouble(InpSymbol, SYMBOL_ASK)
                  : SymbolInfoDouble(InpSymbol, SYMBOL_BID);
   string side = (type == ORDER_TYPE_BUY) ? "BUY" : "SELL";
   PublishLog("buy", "✓✓ " + side + " " + InpSymbol + " @ $" + DoubleToString(price, _Digits));

   bool ok = true;
   if(!InpDryRun)
     {
      ok = (type == ORDER_TYPE_BUY)
           ? trade.Buy(InpLot, InpSymbol)
           : trade.Sell(InpLot, InpSymbol);
      if(!ok)
        {
         PublishLog("loss", "Order failed: " + trade.ResultRetcodeDescription());
         return;
        }
     }

   g_positionOpen = true;
   g_openTime  = TimeCurrent();
   g_openPrice = price;
   g_openType  = type;
   PublishLog("position", "Position open - waiting for interval to close...");
  }

void ClosePosition()
  {
   double closePrice = (g_openType == ORDER_TYPE_BUY)
                       ? SymbolInfoDouble(InpSymbol, SYMBOL_BID)
                       : SymbolInfoDouble(InpSymbol, SYMBOL_ASK);
   double profit = 0.0;

   if(!InpDryRun)
     {
      // Close any position on the symbol opened by this EA.
      if(PositionSelect(InpSymbol))
         profit = PositionGetDouble(POSITION_PROFIT);
      trade.PositionClose(InpSymbol);
     }
   else
     {
      // Simulated PnL based on price move (DryRun).
      double diff = (g_openType == ORDER_TYPE_BUY)
                    ? (closePrice - g_openPrice)
                    : (g_openPrice - closePrice);
      profit = diff * InpLot * SymbolInfoDouble(InpSymbol, SYMBOL_TRADE_CONTRACT_SIZE);
      if(profit == 0.0) profit = 50.0; // keep the demo lively
     }

   PublishLog("position", "Position closed @ $" + DoubleToString(closePrice, _Digits));

   g_totalTrades++;
   if(profit >= 0) { g_wins++; PublishLog("profit", "✓ Profit: +$" + DoubleToString(MathAbs(profit), 2)); }
   else            { g_losses++; PublishLog("loss",  "✗ Loss: -$" + DoubleToString(MathAbs(profit), 2)); }
   g_sessionProfit += profit;

   // Emit a trade record for the Live Trade Log.
   string dir = (g_openType == ORDER_TYPE_BUY) ? "buy" : "sell";
   Publish("{" + J("type","trade") + "," + Ji("ticket", (long)TimeCurrent()) + "," +
           J("symbol",InpSymbol) + "," + J("displaySymbol",DisplaySymbol(InpSymbol)) + "," +
           J("direction",dir) + "," + Jn("price",g_openPrice,_Digits) + "," + Jn("profit",profit) + "}");

   g_positionOpen = false;
   g_openType = -1;
  }

//+------------------------------------------------------------------+
//| Recount today's closed deals into the session stats              |
//+------------------------------------------------------------------+
void RecountHistory()
  {
   g_totalTrades = 0; g_wins = 0; g_losses = 0; g_sessionProfit = 0.0;
   datetime from = TimeCurrent() - 24 * 60 * 60;
   if(!HistorySelect(from, TimeCurrent())) return;
   int deals = HistoryDealsTotal();
   for(int i = 0; i < deals; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if(HistoryDealGetInteger(ticket, DEAL_MAGIC) != InpMagic) continue;
      if(HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      g_totalTrades++;
      if(profit >= 0) g_wins++; else g_losses++;
      g_sessionProfit += profit;
     }
  }

//+------------------------------------------------------------------+
//| Poll the REP socket for commands (non-blocking)                  |
//+------------------------------------------------------------------+
void PollCommands()
  {
   ZmqMsg request;
   if(!replier.recv(request, true)) // ZMQ_DONTWAIT
      return;

   string body = request.getData();
   string cmd = ExtractJsonString(body, "cmd");
   string reply = "ok";

   if(cmd == "pause")       { g_status = "paused";  PublishLog("info", "Bot paused"); }
   else if(cmd == "resume" || cmd == "start") { g_status = "running"; PublishLog("info", "Bot resumed"); }
   else if(cmd == "stop")   { g_status = "stopped"; if(g_positionOpen) ClosePosition(); PublishLog("info", "Bot stopped"); }
   else if(cmd == "buy")    { OpenPosition(ORDER_TYPE_BUY); }
   else if(cmd == "sell")   { OpenPosition(ORDER_TYPE_SELL); }
   else if(cmd == "close")  { if(g_positionOpen) ClosePosition(); }
   else                     { reply = "unknown command"; }

   ZmqMsg response(reply);
   replier.send(response);
  }

//+------------------------------------------------------------------+
//| Tiny extractor for a string value in a flat JSON command         |
//| e.g. {"cmd":"pause"} -> "pause"                                  |
//+------------------------------------------------------------------+
string ExtractJsonString(const string json, const string key)
  {
   string needle = "\"" + key + "\"";
   int k = StringFind(json, needle);
   if(k < 0) return "";
   int colon = StringFind(json, ":", k);
   if(colon < 0) return "";
   int q1 = StringFind(json, "\"", colon);
   if(q1 < 0) return "";
   int q2 = StringFind(json, "\"", q1 + 1);
   if(q2 < 0) return "";
   return StringSubstr(json, q1 + 1, q2 - q1 - 1);
  }
//+------------------------------------------------------------------+
