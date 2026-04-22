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

// ============================================
// HEALTH CHECK - TANPA AUTH
// ============================================
app.get('/ping', (req, res) => res.send('pong'));

// Test endpoint sederhana
app.get('/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    symbol: 'XAUUSD',
    action: 'BUY',
    confidence: 0.75,
    sl: 0.004,
    tp: 0.008,
    lot: 0.01
  });
});

// ============================================
// AUTH MIDDLEWARE - Untuk endpoint lain
// ============================================
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  // Skip auth untuk origin localhost (untuk development)
  if (!apiKey || apiKey === API_KEY) {
    next();
  } else {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
});

// ============================================
// ENDPOINT SINYAL UNTUK EA
// ============================================
app.get('/api/signal', (req, res) => {
  const symbol = req.query.symbol || 'EURUSD';
  
  // Spawn Python process - PATH SUDAH DIPERBAIKI
  const py = spawn('python3', ['./ai_inference.py', symbol]);
  let output = '';
  
  py.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  py.on('close', () => {
    try {
      const signal = JSON.parse(output);
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

// ============================================
// ENDPOINT LOG TRADE DARI EA
// ============================================
app.post('/api/trade-log', (req, res) => {
  const tradeData = req.body;
  console.log('📊 Trade received:', tradeData);
  
  // Broadcast ke WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'trade', payload: tradeData }));
    }
  });
  
  res.json({ status: 'ok' });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
});