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
// GLOBAL STATE (Dijadikan 'let' supaya bisa diubah lewat Dashboard)
// ==========================================
let globalTradingMode = 'scalping';
let globalSymbol = 'XAUUSD';
let dailyTarget = 60;
let maxDailyLoss = 30;
let dailyProfit = 0;
let isTradingActive = true;
let testMode = false; 

// Telegram Config (Bisa diisi dari Railway Variables ATAU Dashboard)
let TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
let TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Fungsi Kirim Telegram
async function sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) return; // Jangan kirim kalau belum disetting
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'Markdown' })
    });
  } catch (e) { console.error('TG Error:', e); }
}

// ==========================================
// ROUTES
// ==========================================
app.get('/ping', (req, res) => res.send('pong'));

app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key === API_KEY) next();
  else res.status(401).json({ error: 'Invalid API Key' });
});

// GET Mode
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

// POST Mode (INI YANG DIPERBAIKI BIAR BISA SAVE TELEGRAM)
app.post('/api/mode', (req, res) => {
  const { mode, symbol, dailyTarget: dt, maxDailyLoss: mdl, tgToken, tgChat } = req.body;
  
  if (mode) globalTradingMode = mode;
  if (symbol) globalSymbol = symbol;
  if (dt) dailyTarget = parseFloat(dt);
  if (mdl) maxDailyLoss = parseFloat(mdl);
  
  // Simpan Telegram Credentials dari Dashboard
  if (tgToken) TG_TOKEN = tgToken;
  if (tgChat) TG_CHAT_ID = tgChat;

  const payload = { mode: globalTradingMode, symbol: globalSymbol, dailyTarget, maxDailyLoss, isTradingActive };
  
  // Broadcast update
  wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'mode_update', payload })));
  
  res.json({ status: 'ok', payload, message: 'Settings saved' });
});

// Test Mode Toggle
app.post('/api/test-mode', (req, res) => {
  const { enabled } = req.body;
  testMode = !!enabled;
  process.env.TEST_MODE = testMode ? 'true' : 'false';
  console.log(`🧪 Test Mode set to: ${testMode}`);
  res.json({ status: 'ok', testMode });
});

// Get Signal
app.get('/api/signal', (req, res) => {
  const symbol = req.query.symbol || globalSymbol;
  console.log(`📡 Signal: ${symbol} | Mode: ${globalTradingMode} | Test: ${testMode}`);
  
  const py = spawn('python3', ['./ai_inference.py', symbol, globalTradingMode]);
  let out = '';
  py.stdout.on('data', d => out += d.toString());
  
  py.on('close', () => {
    try {
      const signal = JSON.parse(out);
      signal.tradingMode = globalTradingMode;
      signal.isTradingActive = isTradingActive;
      signal.testMode = testMode;
      
      wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'signal', payload: signal })));
      res.json(signal);
    } catch (err) {
      console.error('Parse Error:', err);
      res.status(500).json({ error: 'AI parse failed', raw: out });
    }
  });
});

// Trade Log
app.post('/api/trade-log', (req, res) => {
  const trade = req.body;
  console.log('📊 Trade Log:', trade);
  
  if (trade.profit !== undefined) {
    dailyProfit += parseFloat(trade.profit);
    if (dailyProfit >= dailyTarget) { isTradingActive = false; console.log('🎯 Target Reached!'); }
    if (dailyProfit <= -maxDailyLoss) { isTradingActive = false; console.log('🛑 Max Loss Hit!'); }
  }
  
  // Send Telegram Alert (Sekarang pasti jalan kalau Token/ID sudah di-save)
  if (trade.action !== 'HOLD') {
    sendTelegram(`🚀 *NEW SIGNAL*\n💰 Pair: ${trade.symbol}\n📊 Action: *${trade.action}*\n📈 Lot: ${trade.lot}\n💵 Profit: $${trade.profit || 0}`);
  }
  
  wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: 'trade', payload: trade })));
  res.json({ status: 'ok', dailyProfit, isTradingActive });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));