// frontend/src/App.jsx
import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = 'https://ai-trading-system-production-5b49.up.railway.app'
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
const PAIRS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD']

function App() {
  const [connected, setConnected] = useState(false)
  const [signal, setSignal] = useState(null)
  const [log, setLog] = useState([])
  const [mode, setMode] = useState('scalping')
  const [pair, setPair] = useState('XAUUSD')
  const [target, setTarget] = useState(60)
  const [maxLoss, setMaxLoss] = useState(30)
  const [profit, setProfit] = useState(0)
  const [active, setActive] = useState(true)
  const [testMode, setTestMode] = useState(false)
  const [tgToken, setTgToken] = useState('')
  const [tgChat, setTgChat] = useState('')
  const [notif, setNotif] = useState('')

  // Fungsi Update
  const update = useCallback(async (path, body) => {
    await fetch(`${API_URL}${path}`, { 
      method: 'POST', 
      headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify(body) 
    })
  }, [])

  // Fetch Mode & Settings
  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mode`)
      const d = await res.json()
      setMode(d.mode)
      setPair(d.symbol)
      setTarget(d.dailyTarget)
      setMaxLoss(d.maxDailyLoss)
      setProfit(d.dailyProfit)
      setActive(d.isTradingActive)
      setTestMode(d.testMode || false)
    } catch {
      console.error('Fetch mode error')
    }
  }, [])

  // WebSocket Connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => { 
      setConnected(true)
      fetchMode() 
    }
    
    ws.onmessage = e => {
      const d = JSON.parse(e.data)
      if (d.type === 'signal') { 
        setSignal(d.payload)
        setProfit(d.payload.dailyProfit || 0)
        setActive(d.payload.isTradingActive)
      }
      if (d.type === 'trade') {
        setLog(prev => [d.payload, ...prev].slice(0, 20))
      }
      if (d.type === 'mode_update') { 
        setMode(d.payload.mode)
        setPair(d.payload.symbol)
        setTarget(d.payload.dailyTarget)
        setMaxLoss(d.payload.maxDailyLoss)
      }
    }
    
    ws.onclose = () => setConnected(false)
    
    return () => ws.close()
  }, [fetchMode])

  // Signal Fetch Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!active) return
      try {
        const res = await fetch(`${API_URL}/api/signal?symbol=${pair}`)
        const d = await res.json()
        setSignal(d)
      } catch {
        console.error('Fetch signal error')
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [pair, active])

  // UI Helpers
  const color = (act) => act === 'BUY' ? '#10b981' : act === 'SELL' ? '#ef4444' : '#f59e0b'
  const pct = target ? Math.min((profit / target) * 100, 100) : 0

  // Render UI
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span>🤖</span>
          <h1>AI Trading System</h1>
        </div>
        <div className="controls">
          <div className={`status ${connected?'on':'off'}`}>
            {connected?'● Live':'○ Offline'}
          </div>
          <button 
            className={`btn ${active?'green':'red'}`} 
            onClick={() => { 
              const n=!active
              setActive(n)
              update('/api/trading/control', {action:n?'start':'stop'}) 
            }}
          >
            {active?'⏸ Pause':'▶ Resume'}
          </button>
        </div>
      </header>

      {/* Daily Progress */}
      <div className="card">
        <h3>📊 Daily Progress</h3>
        <div className="prog-bar">
          <div className="prog-fill" style={{
            width:`${pct}%`, 
            background: profit>=target?'#10b981':profit<=-maxLoss?'#ef4444':'#60a5fa'
          }}></div>
        </div>
        <div className="stats-row">
          <span>Target: ${target}</span>
          <span>Current: ${profit.toFixed(2)}</span>
          <span>Max Loss: ${maxLoss}</span>
        </div>
      </div>

      {/* Settings */}
      <div className="grid-3">
        <div className="input-group">
          <label>PAIR</label>
          <select value={pair} onChange={e => { 
            setPair(e.target.value)
            update('/api/mode', {symbol:e.target.value}) 
          }}>
            {PAIRS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>TARGET ($)</label>
          <input 
            type="number" 
            value={target} 
            onChange={e => { 
              setTarget(+e.target.value)
              update('/api/mode', {dailyTarget:+e.target.value}) 
            }} 
          />
        </div>
        <div className="input-group">
          <label>MAX LOSS ($)</label>
          <input 
            type="number" 
            value={maxLoss} 
            onChange={e => { 
              setMaxLoss(+e.target.value)
              update('/api/mode', {maxDailyLoss:+e.target.value}) 
            }} 
          />
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="mode-row">
        <div className={`mode-btn ${mode==='scalping'?'active':''}`} 
             onClick={() => { 
               setMode('scalping')
               update('/api/mode', {mode:'scalping'}) 
             }}>
          ⚡ Scalping
        </div>
        <div className={`mode-btn ${mode==='intraday'?'active':''}`} 
             onClick={() => { 
               setMode('intraday')
               update('/api/mode', {mode:'intraday'}) 
             }}>
          📈 Intraday
        </div>
        <div className={`mode-btn ${testMode?'active':''}`} 
             onClick={() => { 
               const n=!testMode
               setTestMode(n)
               update('/api/test-mode', {enabled:n}) 
             }}>
          🧪 Test Mode
        </div>
      </div>

      {/* Telegram Setup */}
      <div className="card tg-card">
        <h3>📱 Telegram Notifications</h3>
        <div className="grid-2">
          <input 
            placeholder="Bot Token" 
            value={tgToken} 
            onChange={e => setTgToken(e.target.value)} 
          />
          <input 
            placeholder="Chat ID" 
            value={tgChat} 
            onChange={e => setTgChat(e.target.value)} 
          />
        </div>
        <button 
          className="btn blue" 
          onClick={async () => {
            try {
              await update('/api/mode', {tgToken, tgChat})
              setNotif('✅ Telegram berhasil disimpan!')
              setTimeout(() => setNotif(''), 3000)
            } catch {
              setNotif('❌ Gagal menyimpan. Pastikan backend Railway sudah online.')
              setTimeout(() => setNotif(''), 3000)
            }
          }}
        >
          💾 Save Telegram
        </button>
        
        {/* Notification */}
        {notif && (
          <div className={`notif ${notif.includes('✅')?'success':'error'}`}>
            {notif}
          </div>
        )}
      </div>

      {/* Signal Display */}
      {signal && (
        <div className="signal-card">
          <div className="sig-head">
            <h2>{signal.symbol} 
              <span className={`badge ${signal.action.toLowerCase()}`}>
                {signal.action}
              </span>
            </h2>
            <div className="circle" style={{borderColor:color(signal.action)}}>
              {(signal.confidence*100).toFixed(0)}%
            </div>
          </div>
          <div className="grid-3">
            <div className="box">
              <span>SL</span>
              <b className="red">{signal.sl||'N/A'}</b>
            </div>
            <div className="box">
              <span>TP</span>
              <b className="green">{signal.tp||'N/A'}</b>
            </div>
            <div className="box">
              <span>Lot</span>
              <b>{signal.lot||0.01}</b>
            </div>
          </div>
          <div className="indicators">
            {signal.reasoning?.map((r,i) => (
              <div key={i} className="tag">{r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="card">
        <h3>📋 Trade Log</h3>
        {log.length===0 ? (
          <p>Belum ada trade...</p>
        ) : (
          log.map((t,i) => (
            <div key={i} className={`log-item ${t.action.toLowerCase()}`}>
              <span>{t.symbol}</span>
              <span className={`act ${t.action.toLowerCase()}`}>{t.action}</span>
              <span>Profit: ${t.profit?.toFixed(2)||'0'}</span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>AI Trading System • Powered by Railway & Vercel</p>
      </footer>
    </div>
  )
}

export default App