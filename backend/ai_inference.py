# backend/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
import ta
import requests
from datetime import datetime, timedelta

def get_market_data(symbol):
    """
    Ambil data market dari API (gunakan Alpha Vantage, Yahoo Finance, atau mock data)
    """
    try:
        # Mock data untuk demo - ganti dengan API real seperti Alpha Vantage/Yahoo Finance
        # Contoh: https://www.alphavantage.co/query?function=FX_INTRADAY...
        
        # Generate mock OHLCV data
        dates = pd.date_range(end=datetime.now(), periods=100, freq='15min')
        base_price = 1850 if 'XAU' in symbol else 1.0800
        
        data = pd.DataFrame({
            'timestamp': dates,
            'open': base_price + np.random.randn(100) * 2,
            'high': base_price + np.random.randn(100) * 2.5,
            'low': base_price + np.random.randn(100) * 2.5,
            'close': base_price + np.random.randn(100) * 2,
            'volume': np.random.randint(100, 1000, 100)
        })
        
        return data
    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        return None

def calculate_indicators(df):
    """
    Hitung technical indicators
    """
    # RSI
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    
    # MACD
    df['macd'] = ta.trend.MACD(df['close']).macd()
    df['macd_signal'] = ta.trend.MACD(df['close']).macd_signal()
    
    # EMA
    df['ema_20'] = ta.trend.EMAIndicator(df['close'], window=20).ema_indicator()
    df['ema_50'] = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    
    # Bollinger Bands
    bb = ta.volatility.BollingerBands(df['close'], window=20)
    df['bb_upper'] = bb.bollinger_hband()
    df['bb_lower'] = bb.bollinger_lband()
    df['bb_middle'] = bb.bollinger_mavg()
    
    # ATR (untuk calculate SL/TP)
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()
    
    # ADX
    df['adx'] = ta.trend.ADXIndicator(df['high'], df['low'], df['close'], window=14).adx()
    
    return df

def calculate_sl_tp(df, action, mode='scalping'):
    """
    Hitung Stop Loss dan Take Profit berdasarkan ATR dan mode trading
    """
    current_price = df['close'].iloc[-1]
    atr = df['atr'].iloc[-1]
    
    if mode == 'scalping':
        # Scalping: SL/TP lebih ketat
        sl_multiplier = 1.5
        tp_multiplier = 2.5
    else:  # intraday
        # Intraday: SL/TP lebih longgar
        sl_multiplier = 2.5
        tp_multiplier = 4.0
    
    if action == 'BUY':
        sl = current_price - (atr * sl_multiplier)
        tp = current_price + (atr * tp_multiplier)
    elif action == 'SELL':
        sl = current_price + (atr * sl_multiplier)
        tp = current_price - (atr * tp_multiplier)
    else:  # HOLD
        sl = 0
        tp = 0
    
    return round(sl, 2), round(tp, 2)

def analyze_market(symbol, mode):
    """
    Analisis market dan generate signal
    """
    df = get_market_data(symbol)
    
    if df is None or df.empty:
        return {
            "symbol": symbol,
            "action": "HOLD",
            "confidence": 0.5,
            "sl": 0,
            "tp": 0,
            "lot": 0.01,
            "reasoning": ["Error: Unable to fetch market data"],
            "current_price": 0,
            "indicators": {}
        }
    
    df = calculate_indicators(df)
    
    # Get latest values
    latest = df.iloc[-1]
    rsi = latest['rsi']
    macd = latest['macd']
    macd_signal = latest['macd_signal']
    ema_20 = latest['ema_20']
    ema_50 = latest['ema_50']
    bb_upper = latest['bb_upper']
    bb_lower = latest['bb_lower']
    atr = latest['atr']
    adx = latest['adx']
    current_price = latest['close']
    
    reasoning = []
    action = "HOLD"
    confidence = 0.5
    
    # RSI Analysis
    if rsi < 30:
        reasoning.append(f"RSI oversold: {rsi:.1f}")
        rsi_signal = "BUY"
    elif rsi > 70:
        reasoning.append(f"RSI overbought: {rsi:.1f}")
        rsi_signal = "SELL"
    else:
        reasoning.append(f"RSI neutral: {rsi:.1f}")
        rsi_signal = "HOLD"
    
    # MACD Analysis
    if macd > macd_signal:
        reasoning.append("MACD bullish crossover")
        macd_signal_action = "BUY"
    elif macd < macd_signal:
        reasoning.append("MACD bearish crossover")
        macd_signal_action = "SELL"
    else:
        reasoning.append("MACD no signal")
        macd_signal_action = "HOLD"
    
    # EMA Analysis
    if ema_20 > ema_50:
        reasoning.append("EMA uptrend")
        ema_signal = "BUY"
    elif ema_20 < ema_50:
        reasoning.append("EMA downtrend")
        ema_signal = "SELL"
    else:
        reasoning.append("EMA sideways")
        ema_signal = "HOLD"
    
    # Bollinger Bands Analysis
    if current_price < bb_lower:
        reasoning.append("Price below BB lower band")
        bb_signal = "BUY"
    elif current_price > bb_upper:
        reasoning.append("Price above BB upper band")
        bb_signal = "SELL"
    else:
        reasoning.append("BB neutral")
        bb_signal = "HOLD"
    
    # ADX - Trend Strength
    if adx > 25:
        reasoning.append(f"Strong trend (ADX: {adx:.1f})")
    else:
        reasoning.append(f"Weak trend (ADX: {adx:.1f})")
    
    # Combine signals
    signals = [rsi_signal, macd_signal_action, ema_signal, bb_signal]
    buy_count = signals.count("BUY")
    sell_count = signals.count("SELL")
    
    # Determine action
    if buy_count >= 3:
        action = "BUY"
        confidence = 0.5 + (buy_count * 0.1)
    elif sell_count >= 3:
        action = "SELL"
        confidence = 0.5 + (sell_count * 0.1)
    else:
        action = "HOLD"
        confidence = 0.5
    
    # Cap confidence at 0.95
    confidence = min(confidence, 0.95)
    
    # Calculate SL/TP
    sl, tp = calculate_sl_tp(df, action, mode)
    
    # Determine lot size based on mode
    lot = 0.01 if mode == 'scalping' else 0.02
    
    return {
        "symbol": symbol,
        "action": action,
        "confidence": round(confidence, 2),
        "sl": sl,
        "tp": tp,
        "lot": lot,
        "reasoning": reasoning,
        "current_price": round(current_price, 2),
        "indicators": {
            "rsi": round(rsi, 2),
            "macd": round(macd, 4),
            "ema_20": round(ema_20, 2),
            "atr": round(atr, 2),
            "adx": round(adx, 2)
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No symbol provided"}))
        sys.exit(1)
    
    symbol = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'scalping'
    
    result = analyze_market(symbol, mode)
    print(json.dumps(result))