# backend/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
import ta
import os
from datetime import datetime

def get_market_data(symbol):
    """Ambil data market"""
    try:
        test_mode = os.environ.get('TEST_MODE', 'false').lower() == 'true'
        
        if test_mode:
            dates = pd.date_range(end=datetime.now(), periods=100, freq='5min')
            base_price = 1850 if 'XAU' in symbol else 1.0800
            
            data = pd.DataFrame({
                'timestamp': dates,
                'open': base_price + np.linspace(0, 5, 100),
                'high': base_price + np.linspace(0, 6, 100),
                'low': base_price + np.linspace(0, 4, 100),
                'close': base_price + np.linspace(0, 5, 100),
                'volume': np.random.randint(100, 1000, 100)
            })
            return data
        
        dates = pd.date_range(end=datetime.now(), periods=100, freq='5min')
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
        print(f"Error: {e}", file=sys.stderr)
        return None

def analyze_market(symbol, mode='scalping'):
    df = get_market_data(symbol)
    
    if df is None or df.empty:
        return {"symbol": symbol, "action": "HOLD", "confidence": 0.5, "sl": 0, "tp": 0, "lot": 0.01, "reasoning": ["Error data"], "current_price": 0, "indicators": {}}
    
    # Hitung indikator
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['macd'] = ta.trend.MACD(df['close']).macd()
    df['macd_signal'] = ta.trend.MACD(df['close']).macd_signal()
    df['ema_fast'] = ta.trend.EMAIndicator(df['close'], window=9).ema_indicator()
    df['ema_slow'] = ta.trend.EMAIndicator(df['close'], window=21).ema_indicator()
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()
    
    latest = df.iloc[-1]
    price = latest['close']
    rsi = latest['rsi']
    macd = latest['macd']
    macd_sig = latest['macd_signal']
    ema_fast = latest['ema_fast']
    ema_slow = latest['ema_slow']
    atr = latest['atr']
    
    reasoning = []
    signals = []
    
    # 1. RSI Check
    if rsi < 35:
        reasoning.append(f"RSI Oversold: {rsi:.1f}")
        signals.append(1)
    elif rsi > 65:
        reasoning.append(f"RSI Overbought: {rsi:.1f}")
        signals.append(-1)
    else:
        reasoning.append(f"RSI Neutral: {rsi:.1f}")
        signals.append(0)
    
    # 2. MACD Check
    if macd > macd_sig:
        reasoning.append("MACD Bullish")
        signals.append(1)
    elif macd < macd_sig:
        reasoning.append("MACD Bearish")
        signals.append(-1)
    else:
        reasoning.append("MACD Flat")
        signals.append(0)
    
    # 3. EMA Crossover
    if ema_fast > ema_slow:
        reasoning.append("EMA Uptrend")
        signals.append(1)
    elif ema_fast < ema_slow:
        reasoning.append("EMA Downtrend")
        signals.append(-1)
    else:
        reasoning.append("EMA Flat")
        signals.append(0)
    
    # KEPUTUSAN
    total = sum(signals)
    threshold = 2 if mode == 'scalping' else 3
    
    if total >= threshold:
        action = "BUY"
        confidence = 0.7 + (total * 0.1)
    elif total <= -threshold:
        action = "SELL"
        confidence = 0.7 + (abs(total) * 0.1)
    else:
        action = "HOLD"
        confidence = 0.5
    
    # ==========================================
    # HITUNG SL/TP - FINAL FIX!
    # ==========================================
    # Untuk XAUUSD, minimal SL/TP adalah 100 points (10 pips)
    # Untuk forex, minimal 50 points (5 pips)
    
    is_gold = 'XAU' in symbol or 'GOLD' in symbol.upper()
    min_distance = 100 if is_gold else 50  # Minimal jarak SL/TP
    
    if action == "BUY":
        # SL di bawah harga, TP di atas
        sl = round(price - max(atr * 2, min_distance), 2)
        tp = round(price + max(atr * 3, min_distance * 1.5), 2)
        
    elif action == "SELL":
        # SL di atas harga, TP di bawah
        sl = round(price + max(atr * 2, min_distance), 2)
        tp = round(price - max(atr * 3, min_distance * 1.5), 2)
    else:
        sl = 0
        tp = 0
    
    return {
        "symbol": symbol,
        "action": action,
        "confidence": round(min(confidence, 0.95), 2),
        "sl": sl,
        "tp": tp,
        "lot": 0.01 if mode == 'scalping' else 0.02,
        "reasoning": reasoning,
        "current_price": round(price, 2),
        "indicators": {
            "rsi": round(rsi, 2),
            "macd": round(macd, 4),
            "ema_9": round(ema_fast, 2),
            "atr": round(atr, 2)
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No symbol"}))
        sys.exit(1)
    
    symbol = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'scalping'
    
    result = analyze_market(symbol, mode)
    print(json.dumps(result))