// frontend/src/App.jsx
import { useState, useEffect, useCallback } from 'react'
import './App.css'

// URL Backend Railway
const API_URL = 'https://ai-trading-system-production-5b49.up.railway.app'
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')

// Daftar pair yang tersedia
const AVAILABLE_PAIRS = [
  'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'BTCUSD'
]

function App() {
  const [connected, setConnected] = useState(false)
  const [currentSignal, setCurrentSignal] = useState(null)
  const [tradeLog, setTradeLog] = useState([])
  const [tradingMode, setTradingMode] = useState('scalping')
  const [selectedPair, setSelectedPair] = useState('XAUUSD')
  const [dailyTarget, setDailyTarget] = useState(60)
  const [maxDailyLoss, setMaxDailyLoss] = useState(30)
  const [dailyProfit, setDailyProfit] = useState(0)
  const [isTradingActive, setIsTradingActive] = useState(true)

  // ==========================================
  // FUNGSI-FUNGSI (Deklarasikan SEBELUM useEffect)
  // ==========================================

  // Fetch Mode dari backend
  const fetchMode = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/mode`)
      const data = await response.json()
      setTradingMode(data.mode)
      setSelectedPair(data.symbol)
      setDailyTarget(data.dailyTarget)
      setMaxDailyLoss(data.maxDailyLoss)
      setDailyProfit(data.dailyProfit)
      setIsTradingActive(data.isTradingActive)
    } catch (error) {
      console.error('Error fetching mode:', error)
    }
  }, [])

  // Update mode ke backend
  const updateMode = useCallback(async (mode, symbol, target, maxLoss) => {
    try {
      const response = await fetch(`${API_URL}/api/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, symbol, dailyTarget: target, maxDailyLoss: maxLoss })
      })
      const data = await response.json()
      console.log('Mode updated:', data)
    } catch (error) {
      console.error('Error updating mode:', error)
    }
  }, [])

  // Handle mode change
  const handleModeChange = useCallback((newMode) => {
    setTradingMode(newMode)
    updateMode(newMode, selectedPair, dailyTarget, maxDailyLoss)
  }, [selectedPair, dailyTarget, maxDailyLoss, updateMode])

  // Handle pair change
  const handlePairChange = useCallback((newPair) => {
    setSelectedPair(newPair)
    updateMode(tradingMode, newPair, dailyTarget, maxDailyLoss)
  }, [tradingMode, dailyTarget, maxDailyLoss, updateMode])

  // Handle target change
  const handleTargetChange = useCallback((newTarget) => {
    const target = parseFloat(newTarget)
    setDailyTarget(target)
    updateMode(tradingMode, selectedPair, target, maxDailyLoss)
  }, [tradingMode, selectedPair, maxDailyLoss, updateMode])

  // Handle max loss change
  const handleMaxLossChange = useCallback((newMaxLoss) => {
    const maxLoss = parseFloat(newMaxLoss)
    setMaxDailyLoss(maxLoss)
    updateMode(tradingMode, selectedPair, dailyTarget, maxLoss)
  }, [tradingMode, selectedPair, dailyTarget, updateMode])

  // Toggle trading
  const toggleTrading = useCallback(async () => {
    const newStatus = !isTradingActive
    try {
      await fetch(`${API_URL}/api/trading/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newStatus ? 'start' : 'stop' })
      })
      setIsTradingActive(newStatus)
    } catch (error) {
      console.error('Error toggling trading:', error)
    }
  }, [isTradingActive])

  // WebSocket Connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL)

    websocket.onopen = () => {
      console.log('✅ WebSocket Connected')
      setConnected(true)
      // Request current mode
      fetchMode()
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('📩 Received:', data)
        
        if (data.type === 'signal') {
          setCurrentSignal(data.payload)
          if (data.payload.dailyProfit !== undefined) {
            setDailyProfit(data.payload.dailyProfit)
          }
          if (data.payload.isTradingActive !== undefined) {
            setIsTradingActive(data.payload.isTradingActive)
          }
        } else if (data.type === 'trade') {
          setTradeLog(prev => [data.payload, ...prev].slice(0, 20))
        } else if (data.type === 'mode_update') {
          setTradingMode(data.payload.mode)
          setSelectedPair(data.payload.symbol)
          setDailyTarget(data.payload.dailyTarget)
          setMaxDailyLoss(data.payload.maxDailyLoss)
          setIsTradingActive(data.payload.isTradingActive)
        } else if (data.type === 'daily_profit_update') {
          setDailyProfit(data.payload.dailyProfit)
          setIsTradingActive(data.payload.isTradingActive)
        } else if (data.type === 'trading_control') {
          setIsTradingActive(data.payload.isTradingActive)
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
  }, [fetchMode])

  // Fetch signal
  useEffect(() => {
    const fetchSignal = async () => {
      if (!isTradingActive) return
      
      try {
        const response = await fetch(`${API_URL}/api/signal?symbol=${selectedPair}`)
        const data = await response.json()
        setCurrentSignal(data)
        if (data.dailyProfit !== undefined) {
          setDailyProfit(data.dailyProfit)
        }
      } catch (error) {
        console.error('Error fetching signal:', error)
      }
    }

    fetchSignal()
    const intervalId = setInterval(fetchSignal, 10000)
    return () => clearInterval(intervalId)
  }, [selectedPair, isTradingActive])

  // Helper functions
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

  const getProfitColor = (profit) => {
    if (profit > 0) return '#10b981'
    if (profit < 0) return '#ef4444'
    return '#94a3b8'
  }

  const getProgressPercentage = () => {
    if (dailyTarget === 0) return 0
    return Math.min((dailyProfit / dailyTarget) * 100, 100)
  }

  // ==========================================
  // RENDER UI
  // ==========================================
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <h1>AI Trading System</h1>
          </div>
          <div className="header-controls">
            <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
            <button 
              className={`trading-toggle ${isTradingActive ? 'active' : 'inactive'}`}
              onClick={toggleTrading}
            >
              {isTradingActive ? '🟢 Trading ON' : '🔴 Trading OFF'}
            </button>
          </div>
        </div>
      </header>

      {/* Daily Profit Progress */}
      <div className="daily-profit-card">
        <div className="profit-header">
          <h2>📊 Daily Progress</h2>
          <div className="profit-value" style={{ color: getProfitColor(dailyProfit) }}>
            ${dailyProfit.toFixed(2)} / ${dailyTarget}
          </div>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${getProgressPercentage()}%`,
              backgroundColor: dailyProfit >= dailyTarget ? '#10b981' : 
                               dailyProfit <= -maxDailyLoss ? '#ef4444' : '#60a5fa'
            }}
          ></div>
        </div>
        <div className="profit-stats">
          <span>Target: ${dailyTarget}</span>
          <span>Max Loss: ${maxDailyLoss}</span>
          <span>Current: ${dailyProfit.toFixed(2)}</span>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="settings-panel">
        <div className="setting-group">
          <label>Trading Pair</label>
          <select 
            value={selectedPair} 
            onChange={(e) => handlePairChange(e.target.value)}
            className="setting-select"
          >
            {AVAILABLE_PAIRS.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>
        
        <div className="setting-group">
          <label>Daily Target ($)</label>
          <input 
            type="number" 
            value={dailyTarget}
            onChange={(e) => handleTargetChange(e.target.value)}
            className="setting-input"
            min="10"
            step="10"
          />
        </div>
        
        <div className="setting-group">
          <label>Max Daily Loss ($)</label>
          <input 
            type="number" 
            value={maxDailyLoss}
            onChange={(e) => handleMaxLossChange(e.target.value)}
            className="setting-input"
            min="10"
            step="10"
          />
        </div>
      </div>

      {/* Trading Mode Toggle */}
      <div className="mode-selector">
        <div className={`mode-option ${tradingMode === 'scalping' ? 'active' : ''}`}
             onClick={() => handleModeChange('scalping')}>
          <span className="mode-icon">⚡</span>
          <div>
            <div className="mode-title">Scalping</div>
            <div className="mode-desc">Fast trades (1-15 min)</div>
          </div>
        </div>
        <div className={`mode-option ${tradingMode === 'intraday' ? 'active' : ''}`}
             onClick={() => handleModeChange('intraday')}>
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
                    <span>Profit: <strong style={{ color: getProfitColor(trade.profit) }}>
                      ${trade.profit?.toFixed(2) || '0.00'}
                    </strong></span>
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