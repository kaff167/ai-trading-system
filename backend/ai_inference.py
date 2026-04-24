# backend/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
import ta
import os
import yfinance as yf
from datetime import datetime, timedelta

def get_market_data(symbol):
    """
    Ambil data REAL dari Yahoo Finance
    """
    try:
        # Mapping Symbol MT5 ke Yahoo Finance
        # XAUUSD -> GC=F (Gold Futures)
        # EURUSD -> EURUSD=X
        if 'XAU' in symbol.upper() or 'GOLD' in symbol.upper():
            yf_symbol = "GC=F"
        elif 'EURUSD' in symbol.upper():
            yf_symbol = "EURUSD=X"
        elif 'GBPUSD' in symbol.upper():
            yf_symbol = "GBPUSD=X"
        elif 'USDJPY' in symbol.upper():
            yf_symbol = "USDJPY=X"
        else:
            yf_symbol = "GC=F" # Default Gold

        # Download data 5 hari terakhir dengan interval 5 menit (Cukup untuk hitung indikator)
        df = yf.download(yf_symbol, period="5d", interval="5m", progress=False)
        
        if df.empty:
            print(f"⚠️ Failed to download data for {symbol}", file=sys.stderr)
            return None
        
        # Reset index agar timestamp jadi kolom biasa
        df = df.reset_index()
        
        # Bersihkan nama kolom (kadang yfinance bikin kolom jadi tuple)
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
        
        # Rename kolom agar sesuai standar
        df = df.rename(columns={
            'Datetime': 'timestamp',
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume'
        })
        
        # Ambil kolom yang dibutuhkan saja
        return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]

    except Exception as e:
        print(f"❌ Error fetching market data: {e}", file=sys.stderr)
        return None

def analyze_market(symbol, mode='scalping'):
    """
    Analisis Market dengan Data Real
    """
    df = get_market_data(symbol)
    
    # Handle error kalau data gagal diambil
    if df is None or df.empty:
        return {
            "symbol": symbol, 
            "action": "HOLD", 
            "confidence": 0.5, 
            "sl": 0, 
            "tp": 0, 
            "lot": 0.01, 
            "reasoning": ["Error: Failed to fetch real data"], 
            "current_price": 0, 
            "indicators": {}
        }
    
    # Hitung Indikator
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['macd'] = ta.trend.MACD(df['close']).macd()
    df['macd_signal'] = ta.trend.MACD(df['close']).macd_signal()
    df['ema_fast'] = ta.trend.EMAIndicator(df['close'], window=9).ema_indicator()
    df['ema_slow'] = ta.trend.EMAIndicator(df['close'], window=21).ema_indicator()
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()
    
    # Ambil data candle terakhir
    latest = df.iloc[-1]
    price = latest['close']
    
    # Ambil nilai indikator terakhir
    rsi = latest['rsi']
    macd = latest['macd']
    macd_sig = latest['macd_signal']
    ema_fast = latest['ema_fast']
    ema_slow = latest['ema_slow']
    atr = latest['atr']
    
    reasoning = []
    signals = []
    
    # --- LOGIKA SCALPING SEDERHANA (3 INDIKATOR) ---
    
    # 1. RSI Check
    if rsi < 35:
        reasoning.append(f"RSI Oversold: {rsi:.1f}")
        signals.append(1)  # BUY signal
    elif rsi > 65:
        reasoning.append(f"RSI Overbought: {rsi:.1f}")
        signals.append(-1) # SELL signal
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
    
    # 3. EMA Trend
    if ema_fast > ema_slow:
        reasoning.append("EMA Uptrend")
        signals.append(1)
    elif ema_fast < ema_slow:
        reasoning.append("EMA Downtrend")
        signals.append(-1)
    else:
        reasoning.append("EMA Flat")
        signals.append(0)
    
    # --- KEPUTUSAN ---
    total_score = sum(signals)
    threshold = 2 if mode == 'scalping' else 3  # Scalping lebih agresif
    
    if total_score >= threshold:
        action = "BUY"
        confidence = 0.7 + (total_score * 0.1)
    elif total_score <= -threshold:
        action = "SELL"
        confidence = 0.7 + (abs(total_score) * 0.1)
    else:
        action = "HOLD"
        confidence = 0.5
    
    confidence = min(confidence, 0.95)
    
    # --- HITUNG SL/TP DENGAN HARGA REAL ---
    # Untuk XAUUSD, ATR biasanya sekitar 2-5 poin. 
    # Kita kalikan agar aman dari "Invalid Stops"
    
    is_gold = 'XAU' in symbol.upper()
    
    # Kalikan ATR agar jarak cukup jauh (broker butuh minimal distance)
    sl_distance = max(atr * 2.0, 20.0 if is_gold else 0.0020) # Min 20 poin untuk Gold
    tp_distance = max(atr * 3.0, 30.0 if is_gold else 0.0030) # Min 30 poin untuk Gold
    
    if action == "BUY":
        sl = round(price - sl_distance, 2)
        tp = round(price + tp_distance, 2)
    elif action == "SELL":
        sl = round(price + sl_distance, 2)
        tp = round(price - tp_distance, 2)
    else:
        sl = 0
        tp = 0
    
    return {
        "symbol": symbol,
        "action": action,
        "confidence": round(confidence, 2),
        "sl": sl,
        "tp": tp,
        "lot": 0.01,
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
        print(json.dumps({"error": "No symbol provided"}))
        sys.exit(1)
    
    symbol = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'scalping'
    
    result = analyze_market(symbol, mode)
    print(json.dumps(result))