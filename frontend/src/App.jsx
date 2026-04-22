import { useState, useEffect } from 'react';

export default function App() {
  const [signal, setSignal] = useState(null);
  const [trades, setTrades] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('✅ Connected to Backend');
      setConnected(true);
    };
    
    ws.onclose = () => {
      console.log('❌ Disconnected from Backend');
      setConnected(false);
    };
    
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === 'signal') {
        setSignal(data.payload);
      }
      
      if (data.type === 'trade') {
        setTrades(prev => [data.payload, ...prev].slice(0, 20));
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🤖 AI Trading Dashboard</h1>
        <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
          connected ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {connected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      {signal && (
        <div className={`p-6 rounded-xl mb-8 border-2 ${
          signal.action === 'BUY' 
            ? 'bg-green-900/30 border-green-500' 
            : signal.action === 'SELL' 
              ? 'bg-red-900/30 border-red-500' 
              : 'bg-gray-800 border-gray-600'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {signal.symbol} | {signal.action}
              </h2>
              <p className="text-gray-300">
                Confidence: <span className="font-mono font-bold">{(signal.confidence * 100).toFixed(1)}%</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">SL: {signal.sl}</p>
              <p className="text-sm text-gray-400">TP: {signal.tp}</p>
              <p className="text-sm text-gray-400">Lot: {signal.lot}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Total Trades</p>
          <p className="text-2xl font-bold font-mono">{trades.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Last Action</p>
          <p className="text-2xl font-bold font-mono">
            {trades[0]?.action || '-'}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Backend Port</p>
          <p className="text-2xl font-bold font-mono">3001</p>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-4">📜 Trade Log (Last 20)</h3>
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {trades.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Belum ada trade... Tunggu EA mengirim sinyal!
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {trades.map((t, i) => (
              <div 
                key={i} 
                className="flex justify-between items-center p-4 border-b border-gray-700 hover:bg-gray-700/50 transition"
              >
                <div>
                  <span className="font-bold">{t.symbol}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                    t.action === 'BUY' ? 'bg-green-600' : 'bg-red-600'
                  }`}>
                    {t.action}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>Lot: {t.lot}</p>
                  <p>Conf: {(t.conf * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}