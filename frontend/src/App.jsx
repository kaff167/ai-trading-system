// frontend/src/App.jsx
import { useState, useEffect } from 'react'
import './App.css'

// URL Backend Railway
const API_URL = 'https://ai-trading-system-production-5b49.up.railway.app'
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')

function App() {
  const [connected, setConnected] = useState(false)
  const [currentSignal, setCurrentSignal] = useState(null)
  const [tradeLog, setTradeLog] = useState([])
  const [tradingMode, setTradingMode] = useState('scalping') // 'scalping' atau 'intraday'

  // WebSocket Connection
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

    return () => {
      websocket.close()
    }
  }, [])

  // Fetch Data dengan mode trading
  useEffect(() => {
    const fetchLatestSignal = async () => {
      try {
        const symbol = tradingMode === 'scalping' ? 'XAUUSD' : 'XAUUSD-VIP'
        const response = await fetch(`${API_URL}/api/signal?symbol=${symbol}`)
        if (!response.ok) throw new Error('Network response was not ok')
        const data = await response.json()
        setCurrentSignal(data)
      } catch (error) {
        console.error('Error fetching signal:', error)
      }
    }

    fetchLatestSignal()
    const intervalId = setInterval(fetchLatestSignal, 10000)
    return () => clearInterval(intervalId)
  }, [tradingMode])

  // Helper function untuk warna
  const getActionColor = (action) => {
    if (action === 'BUY') return '#10b981'
    if (action === 'SELL') return '#ef4444'
    return '#f59e0b'
  }

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return '#10b981'
    if (confidence >= 0.5) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <h1>AI Trading System</h1>
          </div>
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* Trading Mode Toggle */}
      <div className="mode-selector">
        <div className={`mode-option ${tradingMode === 'scalping' ? 'active' : ''}`}
             onClick={() => setTradingMode('scalping')}>
          <span className="mode-icon">⚡</span>
          <div>
            <div className="mode-title">Scalping</div>
            <div className="mode-desc">Fast trades (1-15 min)</div>
          </div>
        </div>
        <div className={`mode-option ${tradingMode === 'intraday' ? 'active' : ''}`}
             onClick={() => setTradingMode('intraday')}>
          <span className="mode-icon">📈</span>
          <div>
            <div className="mode-title">Intraday</div>
            <div className="mode-desc">Long trades (1H-1D)</div>
          </div>
        </div>
      </div>

      <main className="main-content">
        {/* Current Signal Card */}
        {currentSignal && (
          <div className="signal-card">
            <div className="card-header">
              <div className="signal-info">
                <h2 className="symbol">{currentSignal.symbol}</h2>
                <span 
                  className="action-badge"
                  style={{ backgroundColor: getActionColor(currentSignal.action) }}
                >
                  {currentSignal.action}
                </span>
              </div>
              <div className="confidence-circle" style={{ 
                borderColor: getConfidenceColor(currentSignal.confidence) 
              }}>
                <span className="confidence-value">
                  {(currentSignal.confidence * 100).toFixed(0)}%
                </span>
                <span className="confidence-label">Confidence</span>
              </div>
            </div>

            {/* Trade Parameters */}
            <div className="trade-params">
              <div className="param-box">
                <span className="param-label">Stop Loss</span>
                <span className="param-value sl">{currentSignal.sl || 'N/A'}</span>
              </div>
              <div className="param-box">
                <span className="param-label">Take Profit</span>
                <span className="param-value tp">{currentSignal.tp || 'N/A'}</span>
              </div>
              <div className="param-box">
                <span className="param-label">Lot Size</span>
                <span className="param-value">{currentSignal.lot || '0.01'}</span>
              </div>
            </div>

            {/* AI Reasoning */}
            {currentSignal.reasoning && (
              <div className="reasoning-section">
                <h3>🧠 AI Reasoning</h3>
                <div className="reasoning-list">
                  {currentSignal.reasoning.map((reason, index) => (
                    <div key={index} className="reasoning-item">
                      <span className="reasoning-icon">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Indicators */}
            {currentSignal.indicators && (
              <div className="indicators-section">
                <h3>📊 Technical Indicators</h3>
                <div className="indicators-grid">
                  <div className="indicator-card">
                    <span className="indicator-name">RSI (14)</span>
                    <span className={`indicator-value ${
                      currentSignal.indicators.rsi > 70 ? 'overbought' : 
                      currentSignal.indicators.rsi < 30 ? 'oversold' : 'neutral'
                    }`}>
                      {currentSignal.indicators.rsi?.toFixed(2)}
                    </span>
                  </div>
                  <div className="indicator-card">
                    <span className="indicator-name">MACD</span>
                    <span className="indicator-value">
                      {currentSignal.indicators.macd?.toFixed(4)}
                    </span>
                  </div>
                  <div className="indicator-card">
                    <span className="indicator-name">EMA 20</span>
                    <span className="indicator-value">
                      {currentSignal.indicators.ema_20?.toFixed(2)}
                    </span>
                  </div>
                  <div className="indicator-card">
                    <span className="indicator-name">ATR</span>
                    <span className="indicator-value">
                      {currentSignal.indicators.atr?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <span className="stat-label">Total Trades</span>
              <span className="stat-value">{tradeLog.length}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <span className="stat-label">Last Action</span>
              <span className="stat-value" style={{ color: getActionColor(currentSignal?.action) }}>
                {currentSignal?.action || '-'}
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🌐</div>
            <div className="stat-content">
              <span className="stat-label">Backend</span>
              <span className="stat-value small">Railway</span>
            </div>
          </div>
        </div>

        {/* Trade Log */}
        <div className="trade-log-section">
          <h2>📋 Trade History (Last 20)</h2>
          {tradeLog.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <p>Belum ada trade... Tunggu EA mengirim sinyal!</p>
            </div>
          ) : (
            <div className="trade-list">
              {tradeLog.map((trade, index) => (
                <div key={index} className={`trade-item ${trade.action?.toLowerCase()}`}>
                  <div className="trade-header">
                    <span className="trade-symbol">{trade.symbol}</span>
                    <span className={`trade-action ${trade.action?.toLowerCase()}`}>
                      {trade.action}
                    </span>
                  </div>
                  <div className="trade-details">
                    <span>Lot: <strong>{trade.lot}</strong></span>
                    <span>Conf: <strong>{(trade.confidence * 100).toFixed(0)}%</strong></span>
                    <span>SL: <strong>{trade.sl || 'N/A'}</strong></span>
                    <span>TP: <strong>{trade.tp || 'N/A'}</strong></span>
                  </div>
                  <span className="trade-time">#{index + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>AI Trading System • Powered by Railway & Vercel</p>
      </footer>
    </div>
  )
}

export default App