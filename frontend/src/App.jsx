// frontend/src/App.jsx
import { useState, useEffect } from 'react'
import './App.css'

// URL Backend Railway kamu
const API_URL = 'https://ai-trading-system-production-5b49.up.railway.app'
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')

function App() {
  const [connected, setConnected] = useState(false)
  const [currentSignal, setCurrentSignal] = useState(null)
  const [tradeLog, setTradeLog] = useState([])

  // ==========================================
  // 1. WebSocket Connection
  // ==========================================
  useEffect(() => {
    const websocket = new WebSocket(WS_URL)

    websocket.onopen = () => {
      console.log('✅ WebSocket Connected')
      setConnected(true)
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('📩 Received:', data)
        
        if (data.type === 'signal') {
          setCurrentSignal(data.payload)
        } else if (data.type === 'trade') {
          setTradeLog(prev => [data.payload, ...prev].slice(0, 20))
        }
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }

    websocket.onclose = () => {
      console.log('❌ WebSocket Disconnected')
      setConnected(false)
    }

    websocket.onerror = (error) => {
      console.error('WebSocket Error:', error)
      setConnected(false)
    }

    // Cleanup saat komponen unmount
    return () => {
      websocket.close()
    }
  }, [])

  // ==========================================
  // 2. Fetch Data (Diperbaiki untuk menghindari error)
  // ==========================================
  useEffect(() => {
    const fetchLatestSignal = async () => {
      try {
        const response = await fetch(`${API_URL}/api/signal?symbol=XAUUSD-VIP`)
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json()
        setCurrentSignal(data)
      } catch (error) {
        console.error('Error fetching signal:', error)
      }
    }

    // Panggil langsung saat pertama load
    fetchLatestSignal()

    // Setup interval untuk refresh setiap 10 detik
    const intervalId = setInterval(fetchLatestSignal, 10000)

    // Cleanup interval saat komponen unmount
    return () => clearInterval(intervalId)
  }, [])

  // ==========================================
  // 3. Render UI
  // ==========================================
  return (
    <div className="App">
      <header className="header">
        <h1>🤖 AI Trading Dashboard</h1>
        <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
      </header>

      <main>
        {/* Current Signal Card */}
        {currentSignal && (
          <div className="signal-card">
            <div className="signal-header">
              <h2>{currentSignal.symbol} | {currentSignal.action}</h2>
              <span className={`confidence ${getConfidenceColor(currentSignal.confidence)}`}>
                Confidence: {(currentSignal.confidence * 100).toFixed(1)}%
              </span>
            </div>
            
            <div className="signal-details">
              <div className="detail-item">
                <span className="label">SL:</span>
                <span className="value">{currentSignal.sl || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">TP:</span>
                <span className="value">{currentSignal.tp || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="label">Lot:</span>
                <span className="value">{currentSignal.lot || '0.01'}</span>
              </div>
            </div>

            {currentSignal.reasoning && (
              <div className="reasoning">
                <h3>🧠 AI Reasoning:</h3>
                <ul>
                  {currentSignal.reasoning.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {currentSignal.indicators && (
              <div className="indicators">
                <h3>📊 Technical Indicators:</h3>
                <div className="indicator-grid">
                  <div className="indicator-item">
                    <span className="indicator-label">RSI:</span>
                    <span className="indicator-value">{currentSignal.indicators.rsi}</span>
                  </div>
                  <div className="indicator-item">
                    <span className="indicator-label">MACD:</span>
                    <span className="indicator-value">{currentSignal.indicators.macd}</span>
                  </div>
                  <div className="indicator-item">
                    <span className="indicator-label">EMA 20:</span>
                    <span className="indicator-value">{currentSignal.indicators.ema_20}</span>
                  </div>
                  <div className="indicator-item">
                    <span className="indicator-label">ATR:</span>
                    <span className="indicator-value">{currentSignal.indicators.atr}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Trades</h3>
            <p className="stat-value">{tradeLog.length}</p>
          </div>
          <div className="stat-card">
            <h3>Last Action</h3>
            <p className="stat-value">{currentSignal?.action || '-'}</p>
          </div>
          <div className="stat-card">
            <h3>Backend Port</h3>
            <p className="stat-value small">Railway</p>
          </div>
        </div>

        {/* Trade Log */}
        <div className="trade-log">
          <h2>📋 Trade Log (Last 20)</h2>
          {tradeLog.length === 0 ? (
            <div className="no-trades">
              <p>Belum ada trade... Tunggu EA mengirim sinyal!</p>
            </div>
          ) : (
            <div className="trade-list">
              {tradeLog.map((trade, index) => (
                <div key={index} className={`trade-item ${trade.action?.toLowerCase()}`}>
                  <div className="trade-info">
                    <span className="trade-symbol">{trade.symbol}</span>
                    <span className={`trade-action ${trade.action?.toLowerCase()}`}>
                      {trade.action}
                    </span>
                  </div>
                  <div className="trade-details">
                    <span>Lot: {trade.lot}</span>
                    <span>Conf: {(trade.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// Helper function untuk warna confidence
function getConfidenceColor(confidence) {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

export default App