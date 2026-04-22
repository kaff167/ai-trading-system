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
// GLOBAL STATE - Trading Mode & Settings
// ==========================================
let globalTradingMode = 'scalping'; // 'scalping' atau 'intraday'
let globalSymbol = 'XAUUSD'; // Default pair
let dailyTarget = 60; // USD
let maxDailyLoss = 30; // USD
let dailyProfit = 0;
let dailyStartBalance = 0;
let isTradingActive = true;

// ==========================================
// HEALTH CHECK - TANPA AUTH
// ==========================================
app.get('/ping', (req, res) => res.send('pong'));

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    symbol: globalSymbol,
    mode: globalTradingMode,
    dailyTarget: dailyTarget,
    dailyProfit: dailyProfit,
    isTradingActive: isTradingActive
  });
});

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey === API_KEY) {
    next();
  } else {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
});

// ==========================================
// API: GET/SET TRADING MODE
// ==========================================
app.get('/api/mode', (req, res) => {
  res.json({ 
    mode: globalTradingMode,
    symbol: globalSymbol,
    dailyTarget: dailyTarget,
    maxDailyLoss: maxDailyLoss,
    dailyProfit: dailyProfit,
    isTradingActive: isTradingActive
  });
});

app.post('/api/mode', (req, res) => {
  const { mode, symbol, dailyTarget: target, maxDailyLoss: maxLoss } = req.body;
  
  if (mode) globalTradingMode = mode;
  if (symbol) globalSymbol = symbol;
  if (target) dailyTarget = parseFloat(target);
  if (maxLoss) maxDailyLoss = parseFloat(maxLoss);
  
  // Broadcast ke semua WebSocket clients
  const modeData = {
    type: 'mode_update',
    payload: {
      mode: globalTradingMode,
      symbol: globalSymbol,
      dailyTarget: dailyTarget,
      maxDailyLoss: maxDailyLoss,
      isTradingActive: isTradingActive
    }
  };
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(modeData));
    }
  });
  
  res.json({ 
    status: 'ok', 
    message: 'Trading mode updated',
    data: modeData.payload
  });
});

// ==========================================
// API: START/STOP TRADING
// ==========================================
app.post('/api/trading/control', (req, res) => {
  const { action } = req.body; // 'start' atau 'stop'
  
  if (action === 'start') {
    isTradingActive = true;
  } else if (action === 'stop') {
    isTradingActive = false;
  }
  
  // Broadcast ke MT5
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'trading_control',
        payload: { isTradingActive: isTradingActive }
      }));
    }
  });
  
  res.json({ status: 'ok', isTradingActive: isTradingActive });
});

// ==========================================
// API: UPDATE DAILY PROFIT
// ==========================================
app.post('/api/daily-profit', (req, res) => {
  const { profit, balance } = req.body;
  
  if (balance && dailyStartBalance === 0) {
    dailyStartBalance = balance;
  }
  
  dailyProfit = parseFloat(profit) || 0;
  
  // Check jika target tercapai
  if (dailyProfit >= dailyTarget) {
    isTradingActive = false;
    console.log(`🎯 Daily target reached! Profit: $${dailyProfit}`);
  }
  
  // Check jika max loss tercapai
  if (dailyProfit <= -maxDailyLoss) {
    isTradingActive = false;
    console.log(`🛑 Max daily loss reached! Loss: $${Math.abs(dailyProfit)}`);
  }
  
  // Broadcast update
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'daily_profit_update',
        payload: { dailyProfit, dailyTarget, maxDailyLoss, isTradingActive }
      }));
    }
  });
  
  res.json({ status: 'ok', dailyProfit, isTradingActive });
});

// ==========================================
// API: GET SIGNAL (Dengan Mode & Pair)
// ==========================================
app.get('/api/signal', (req, res) => {
  // Gunakan symbol dari query atau global
  const symbol = req.query.symbol || globalSymbol;
  
  console.log(`📡 Signal request for ${symbol} (${globalTradingMode})`);
  
  // Spawn Python process - PATH SUDAH DIPERBAIKI
  const py = spawn('python3', ['./ai_inference.py', symbol, globalTradingMode]);
  let output = '';
  
  py.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  py.on('close', () => {
    try {
      const signal = JSON.parse(output);
      
      // Tambahkan info mode dan target
      signal.tradingMode = globalTradingMode;
      signal.dailyTarget = dailyTarget;
      signal.maxDailyLoss = maxDailyLoss;
      signal.isTradingActive = isTradingActive;
      signal.dailyProfit = dailyProfit;
      
      // Broadcast ke WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'signal', payload: signal }));
        }
      });
      
      res.json(signal);
    } catch (err) {
      console.error('Parse error:', err);
      res.status(500).json({ error: 'AI parsing failed', raw: output });
    }
  });
  
  py.stderr.on('data', (data) => {
    console.error('Python error:', data.toString());
  });
});

// ==========================================
// API: LOG TRADE DARI EA
// ==========================================
app.post('/api/trade-log', (req, res) => {
  const tradeData = req.body;
  console.log('📊 Trade received:', tradeData);
  
  // Update daily profit
  if (tradeData.profit !== undefined) {
    dailyProfit += parseFloat(tradeData.profit);
    
    // Check target
    if (dailyProfit >= dailyTarget) {
      isTradingActive = false;
      console.log(`🎯 Daily target reached! Stopping trading.`);
    }
    
    if (dailyProfit <= -maxDailyLoss) {
      isTradingActive = false;
      console.log(`🛑 Max daily loss reached! Stopping trading.`);
    }
  }
  
  // Broadcast ke WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'trade', payload: tradeData }));
    }
  });
  
  res.json({ status: 'ok', dailyProfit, isTradingActive });
});

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
  console.log(`🎯 Daily Target: $${dailyTarget} | Max Loss: $${maxDailyLoss}`);
});