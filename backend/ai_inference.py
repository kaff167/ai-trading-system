# backend/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
import ta
import os
import yfinance as yf
from datetime import datetime

def get_market_data(symbol):
    """Ambil data REAL dari Yahoo Finance"""
    try:
        if 'XAU' in symbol.upper() or 'GOLD' in symbol.upper():
            yf_symbol = "GC=F"
        elif 'EURUSD' in symbol.upper():
            yf_symbol = "EURUSD=X"
        elif 'GBPUSD' in symbol.upper():
            yf_symbol = "GBPUSD=X"
        elif 'USDJPY' in symbol.upper():
            yf_symbol = "USDJPY=X"
        else:
            yf_symbol = "GC=F"

        df = yf.download(yf_symbol, period="2d", interval="5m", progress=False)
        if df.empty: return None
        
        df = df.reset_index()
        df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]
        df = df.rename(columns={'Datetime': 'timestamp', 'Open': 'open', 'High': 'high', 'Low': 'low', 'Close': 'close', 'Volume': 'volume'})
        return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]
    except Exception as e:
        print(f"Error fetch data: {e}", file=sys.stderr)
        return None

def analyze_market(symbol, mode='scalping'):
    df = get_market_data(symbol)
    if df is None or df.empty:
        return {"symbol": symbol, "action": "HOLD", "confidence": 0.5, "sl": 0, "tp": 0, "lot": 0.01, "reasoning": ["No Data"], "current_price": 0, "indicators": {}}

    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['macd'] = ta.trend.MACD(df['close']).macd()
    df['macd_signal'] = ta.trend.MACD(df['close']).macd_signal()
    df['ema_fast'] = ta.trend.EMAIndicator(df['close'], window=9).ema_indicator()
    df['ema_slow'] = ta.trend.EMAIndicator(df['close'], window=21).ema_indicator()
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()

    latest = df.iloc[-1]
    price = latest['close']
    rsi, macd, macd_sig = latest['rsi'], latest['macd'], latest['macd_signal']
    ema_fast, ema_slow, atr = latest['ema_fast'], latest['ema_slow'], latest['atr']

    reasoning, signals = [], []
    if rsi < 35: reasoning.append(f"RSI Oversold: {rsi:.1f}"); signals.append(1)
    elif rsi > 65: reasoning.append(f"RSI Overbought: {rsi:.1f}"); signals.append(-1)
    else: reasoning.append(f"RSI Neutral: {rsi:.1f}"); signals.append(0)

    if macd > macd_sig: reasoning.append("MACD Bullish"); signals.append(1)
    elif macd < macd_sig: reasoning.append("MACD Bearish"); signals.append(-1)
    else: reasoning.append("MACD Flat"); signals.append(0)

    if ema_fast > ema_slow: reasoning.append("EMA Uptrend"); signals.append(1)
    elif ema_fast < ema_slow: reasoning.append("EMA Downtrend"); signals.append(-1)
    else: reasoning.append("EMA Flat"); signals.append(0)

    total = sum(signals)
    threshold = 2 if mode == 'scalping' else 3
    if total >= threshold: action, confidence = "BUY", min(0.7 + (total * 0.1), 0.95)
    elif total <= -threshold: action, confidence = "SELL", min(0.7 + (abs(total) * 0.1), 0.95)
    else: action, confidence = "HOLD", 0.5

    # ==========================================
    # HITUNG SL/TP - FINAL FIX DENGAN SAFETY CLAMP
    # ==========================================
    is_gold = 'XAU' in symbol.upper()
    min_dist = 15.0 if is_gold else 0.0015  # Jarak minimal aman
    
    # Hitung jarak berdasarkan ATR (dikalikan biar tidak terlalu ketat)
    sl_dist = max(atr * 1.5, min_dist)
    tp_dist = max(atr * 2.5, min_dist * 1.5)

    if action == "BUY":
        sl = price - sl_dist
        tp = price + tp_dist
    elif action == "SELL":
        sl = price + sl_dist
        tp = price - tp_dist
    else:
        sl, tp = 0, 0

    # SAFETY CLAMP: Paksa SL/TP valid sebelum dikirim ke MT5
    if action == "BUY":
        if sl >= price: sl = price - sl_dist  # Pastikan SL di BAWAH harga
        if tp <= price: tp = price + tp_dist  # Pastikan TP di ATAS harga
    elif action == "SELL":
        if sl <= price: sl = price + sl_dist  # Pastikan SL di ATAS harga
        if tp >= price: tp = price - tp_dist  # Pastikan TP di BAWAH harga

    return {
        "symbol": symbol, "action": action, "confidence": round(confidence, 2),
        "sl": round(sl, 2), "tp": round(tp, 2), "lot": 0.01,
        "reasoning": reasoning, "current_price": round(price, 2),
        "indicators": {"rsi": round(rsi, 2), "macd": round(macd, 4), "ema_9": round(ema_fast, 2), "atr": round(atr, 2)}
    }

if __name__ == "__main__":
    if len(sys.argv) < 2: print(json.dumps({"error": "No symbol"})); sys.exit(1)
    symbol = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'scalping'
    print(json.dumps(analyze_market(symbol, mode)))