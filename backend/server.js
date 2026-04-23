// backend/server.js
require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const API_KEY = process.env.API_KEY || 'dev-key-123';

// ==========================================
// GLOBAL STATE
// ==========================================
let globalTradingMode = 'scalping';
let globalSymbol = 'XAUUSD';
let dailyTarget = 60;
let maxDailyLoss = 30;
let dailyProfit = 0;
let isTradingActive = true;
let testMode = false;

// Telegram Config (Dimulai dari Environment Variables, tapi bisa diubah lewat Dashboard)
let TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// ==========================================
// TELEGRAM FUNCTION
// ==========================================
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) {
    console.log("⚠️ Telegram not configured (Token/ChatID missing)");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' })
    });
    console.log("✅ Telegram sent.");
  } catch (e) { console.error('TG Error:', e); }
}

// ==========================================
// MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  // Allow requests without key for dev, or check key
  if (key && key !== API_KEY) {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
  next();
});

// ==========================================
// ROUTES
// ==========================================
app.get('/ping', (req, res) => res.send('pong'));

// Get Current Settings
app.get('/api/mode', (req, res) => {
  res.json({
    mode: globalTradingMode,
    symbol: globalSymbol,
    dailyTarget,
    maxDailyLoss,
    dailyProfit,
    isTradingActive,
    testMode
  });
});

// Update Settings (Mode, Symbol, Targets, Telegram)
app.post('/api/mode', (req, res) => {
  const { mode, symbol, dailyTarget: dt, maxDailyLoss: mdl, tgToken, tgChat } = req.body;

  if (mode) globalTradingMode = mode;
  if (symbol) globalSymbol = symbol;
  if (dt) dailyTarget = parseFloat(dt);
  if (mdl) maxDailyLoss = parseFloat(mdl);

  // Update Telegram credentials from frontend input
  if (tgToken) TG_TOKEN = tgToken;
  if (tgChat) TG_CHAT_ID = tgChat;

  console.log(`⚙️ Settings Updated: TG Saved? ${!!(TG_TOKEN && TG_CHAT_ID)}`);

  const payload = { mode: globalTradingMode, symbol: globalSymbol, dailyTarget, maxDailyLoss, isTradingActive };
  
  // Broadcast to frontend
  wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'mode_update', payload })));
  
  res.json({ status: 'ok', payload });
});

// Toggle Test Mode
app.post('/api/test-mode', (req, res) => {
  const { enabled } = req.body;
  testMode = !!enabled;
  // IMPORTANT: Set Environment Variable so Python script inherits it
  process.env.TEST_MODE = testMode ? 'true' : 'false';
  console.log(`🧪 Test Mode: ${testMode} (Env: ${process.env.TEST_MODE})`);
  res.json({ status: 'ok', testMode });
});

// Toggle Trading Control
app.post('/api/trading/control', (req, res) => {
  const { action } = req.body;
  if (action === 'start') isTradingActive = true;
  else if (action === 'stop') isTradingActive = false;
  res.json({ status: 'ok', isTradingActive });
});

// Get AI Signal
app.get('/api/signal', (req, res) => {
  const symbol = req.query.symbol || globalSymbol;
  console.log(`📡 Signal: ${symbol} (Test: ${testMode})`);

  const py = spawn('python3', ['./ai_inference.py', symbol, globalTradingMode]);
  let out = '';
  py.stdout.on('data', d => out += d.toString());

  py.on('close', () => {
    try {
      const signal = JSON.parse(out);
      signal.testMode = testMode;
      signal.isTradingActive = isTradingActive;
      
      // Broadcast to frontend
      wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'signal', payload: signal })));
      res.json(signal);
    } catch (err) {
      console.error('Parse Error:', err, out);
      res.status(500).json({ error: 'AI parse failed' });
    }
  });
});

// Receive Trade Log from MT5
app.post('/api/trade-log', (req, res) => {
  const trade = req.body;
  console.log('📊 Trade Log:', trade);

  if (trade.profit !== undefined) {
    dailyProfit += parseFloat(trade.profit);
    if (dailyProfit >= dailyTarget) { 
      isTradingActive = false; 
      sendTelegram("🎯 Daily Target Reached!"); 
    }
    if (dailyProfit <= -maxDailyLoss) { 
      isTradingActive = false; 
      sendTelegram("🛑 Max Loss Reached!"); 
    }
  }

  // Send Telegram Alert
  if (trade.action !== 'HOLD') {
    sendTelegram(`🚀 *NEW TRADE*\nPair: ${trade.symbol}\nAction: *${trade.action}*\nProfit: $${trade.profit || 0}`);
  }

  wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'trade', payload: trade })));
  res.json({ status: 'ok', dailyProfit, isTradingActive });
});

// Start Server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));