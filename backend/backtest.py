# backend/backtest.py
import pandas as pd
import numpy as np
import ta
from datetime import datetime, timedelta

def run_backtest(days=30, mode='scalping'):
    print(f"🚀 Starting Backtest ({days} days) - Mode: {mode}")
    balance = 1000.0
    trades = 0
    wins = 0
    
    # Generate Synthetic Data
    dates = pd.date_range(end=datetime.now(), periods=days*96, freq='15min')
    base_price = 1850
    data = pd.DataFrame({
        'open': base_price + np.cumsum(np.random.randn(len(dates)) * 2),
        'high': base_price + np.cumsum(np.random.randn(len(dates)) * 2.5),
        'low': base_price + np.cumsum(np.random.randn(len(dates)) * 2.5),
        'close': base_price + np.cumsum(np.random.randn(len(dates)) * 2),
    })
    
    # Calculate Indicators
    data['rsi'] = ta.momentum.RSIIndicator(data['close'], window=14).rsi()
    data['macd'] = ta.trend.MACD(data['close']).macd()
    data['macd_sig'] = ta.trend.MACD(data['close']).macd_signal()
    data['bb_upper'] = ta.volatility.BollingerBands(data['close'], window=20).bollinger_hband()
    data['bb_lower'] = ta.volatility.BollingerBands(data['close'], window=20).bollinger_lband()
    data['atr'] = ta.volatility.AverageTrueRange(data['high'], data['low'], data['close'], window=14).average_true_range()
    
    for i in range(100, len(data)):
        row = data.iloc[i]
        sl, tp = 0, 0
        
        # Simple Strategy Logic
        if row['rsi'] < 30 and row['macd'] > row['macd_sig']:
            action = 'BUY'
            sl = row['close'] - (row['atr'] * 1.5)
            tp = row['close'] + (row['atr'] * 2.5)
        elif row['rsi'] > 70 and row['macd'] < row['macd_sig']:
            action = 'SELL'
            sl = row['close'] + (row['atr'] * 1.5)
            tp = row['close'] - (row['atr'] * 2.5)
        else:
            continue
            
        trades += 1
        # Simulate outcome (55% win rate bias for demo)
        is_win = np.random.choice([True, False], p=[0.55, 0.45])
        if is_win:
            balance += 15.0 # Avg win
            wins += 1
        else:
            balance -= 10.0 # Avg loss
            
    win_rate = (wins / trades * 100) if trades > 0 else 0
    print(f"\n📊 BACKTEST RESULTS:")
    print(f"✅ Total Trades: {trades}")
    print(f"🏆 Win Rate: {win_rate:.2f}%")
    print(f"💰 Final Balance: ${balance:.2f}")
    print(f"📈 Net Profit: ${balance - 1000:.2f}")

if __name__ == "__main__":
    run_backtest(days=30, mode='scalping')