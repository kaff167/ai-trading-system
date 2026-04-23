# backend/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
import ta
import requests
from datetime import datetime, timedelta
import os

def get_market_data(symbol):
    """
    Ambil data market - bisa pakai mock data atau API real
    """
    try:
        # MODE TESTING: Force data untuk testing
        test_mode = os.environ.get('TEST_MODE', 'false').lower() == 'true'
        
        if test_mode:
            # Generate data yang pasti kasih signal BUY untuk testing
            dates = pd.date_range(end=datetime.now(), periods=100, freq='15min')
            base_price = 1850 if 'XAU' in symbol else 1.0800
            
            # Trend naik kuat untuk testing
            data = pd.DataFrame({
                'timestamp': dates,
                'open': base_price + np.linspace(0, 10, 100) + np.random.randn(100) * 0.5,
                'high': base_price + np.linspace(0, 12, 100) + np.random.randn(100) * 0.5,
                'low': base_price + np.linspace(0, 8, 100) + np.random.randn(100) * 0.5,
                'close': base_price + np.linspace(0, 10, 100) + np.random.randn(100) * 0.5,
                'volume': np.random.randint(100, 1000, 100)
            })
            return data
        
        # PRODUCTION: Pakai mock data normal
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
        print(f"Error fetching  {e}", file=sys.stderr)
        return None

def calculate_indicators(df):
    """
    Hitung SEMUA technical indicators
    """
    # === INDIKATOR TREND ===
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
    df['stoch_k'] = ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=14).stoch()
    df['stoch_d'] = ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=14, smooth_window=3).stoch()
    
    # MACD
    df['macd'] = ta.trend.MACD(df['close']).macd()
    df['macd_signal'] = ta.trend.MACD(df['close']).macd_signal()
    df['macd_diff'] = df['macd'] - df['macd_signal']
    
    # EMA
    df['ema_9'] = ta.trend.EMAIndicator(df['close'], window=9).ema_indicator()
    df['ema_20'] = ta.trend.EMAIndicator(df['close'], window=20).ema_indicator()
    df['ema_50'] = ta.trend.EMAIndicator(df['close'], window=50).ema_indicator()
    
    # === INDIKATOR VOLATILITAS ===
    # Bollinger Bands
    bb = ta.volatility.BollingerBands(df['close'], window=20)
    df['bb_upper'] = bb.bollinger_hband()
    df['bb_lower'] = bb.bollinger_lband()
    df['bb_middle'] = bb.bollinger_mavg()
    df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
    
    # ATR
    df['atr'] = ta.volatility.AverageTrueRange(df['high'], df['low'], df['close'], window=14).average_true_range()
    
    # === INDIKATOR VOLUME ===
    df['obv'] = ta.volume.OnBalanceVolumeIndicator(df['close'], df['volume']).on_balance_volume()
    df['volume_sma'] = df['volume'].rolling(window=20).mean()
    
    # === INDIKATOR TREND STRENGTH ===
    df['adx'] = ta.trend.ADXIndicator(df['high'], df['low'], df['close'], window=14).adx()
    df['cci'] = ta.trend.CCIIndicator(df['high'], df['low'], df['close'], window=20).cci()
    
    return df

def calculate_sl_tp(df, action, mode='scalping'):
    """
    Hitung Stop Loss dan Take Profit yang LEBIH CERDAS
    """
    current_price = df['close'].iloc[-1]
    atr = df['atr'].iloc[-1]
    bb_upper = df['bb_upper'].iloc[-1]
    bb_lower = df['bb_lower'].iloc[-1]
    
    # Tentukan multiplier berdasarkan mode
    if mode == 'scalping':
        sl_multiplier = 1.5
        tp_multiplier = 2.5
        min_rr = 1.5  # Minimal risk-reward ratio
    else:  # intraday
        sl_multiplier = 2.5
        tp_multiplier = 4.0
        min_rr = 2.0
    
    if action == 'BUY':
        # SL di bawah support (BB lower atau ATR)
        sl_distance = max(atr * sl_multiplier, current_price - bb_lower)
        sl = current_price - sl_distance
        
        # TP di atas resistance (BB upper atau ATR)
        tp_distance = max(atr * tp_multiplier, bb_upper - current_price)
        
        # Pastikan risk-reward ratio minimal terpenuhi
        risk = current_price - sl
        min_tp = current_price + (risk * min_rr)
        tp = max(current_price + tp_distance, min_tp)
        
    elif action == 'SELL':
        # SL di atas resistance
        sl_distance = max(atr * sl_multiplier, bb_upper - current_price)
        sl = current_price + sl_distance
        
        # TP di bawah support
        tp_distance = max(atr * tp_multiplier, current_price - bb_lower)
        
        # Pastikan risk-reward ratio
        risk = sl - current_price
        min_tp = current_price - (risk * min_rr)
        tp = min(current_price - tp_distance, min_tp)
    else:  # HOLD
        sl = 0
        tp = 0
    
    return round(sl, 2), round(tp, 2)

def analyze_market(symbol, mode='scalping'):
    """
    Analisis market dengan SEMUA indikator
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
    current_price = latest['close']
    
    # === ANALISIS MULTI-TIMEFRAME ===
    reasoning = []
    signals = []
    confidence_score = 0
    
    # 1. RSI Analysis
    rsi = latest['rsi']
    if rsi < 30:
        reasoning.append(f"RSI oversold: {rsi:.1f}")
        signals.append(1)  # BUY signal
        confidence_score += 1
    elif rsi > 70:
        reasoning.append(f"RSI overbought: {rsi:.1f}")
        signals.append(-1)  # SELL signal
        confidence_score += 1
    else:
        reasoning.append(f"RSI neutral: {rsi:.1f}")
        signals.append(0)
    
    # 2. Stochastic Analysis
    stoch_k = latest['stoch_k']
    stoch_d = latest['stoch_d']
    if stoch_k < 20 and stoch_k > stoch_d:
        reasoning.append(f"Stochastic oversold & crossing up")
        signals.append(1)
        confidence_score += 1
    elif stoch_k > 80 and stoch_k < stoch_d:
        reasoning.append(f"Stochastic overbought & crossing down")
        signals.append(-1)
        confidence_score += 1
    else:
        reasoning.append(f"Stochastic neutral: K={stoch_k:.1f}, D={stoch_d:.1f}")
        signals.append(0)
    
    # 3. MACD Analysis
    macd = latest['macd']
    macd_signal = latest['macd_signal']
    macd_diff = latest['macd_diff']
    if macd > macd_signal and macd_diff > 0:
        reasoning.append("MACD bullish crossover")
        signals.append(1)
        confidence_score += 1
    elif macd < macd_signal and macd_diff < 0:
        reasoning.append("MACD bearish crossover")
        signals.append(-1)
        confidence_score += 1
    else:
        reasoning.append("MACD no clear signal")
        signals.append(0)
    
    # 4. EMA Trend
    ema_9 = latest['ema_9']
    ema_20 = latest['ema_20']
    ema_50 = latest['ema_50']
    if ema_9 > ema_20 > ema_50:
        reasoning.append("Strong uptrend (EMA alignment)")
        signals.append(1)
        confidence_score += 1.5
    elif ema_9 < ema_20 < ema_50:
        reasoning.append("Strong downtrend (EMA alignment)")
        signals.append(-1)
        confidence_score += 1.5
    else:
        reasoning.append("EMA mixed/no clear trend")
        signals.append(0)
    
    # 5. Bollinger Bands
    bb_upper = latest['bb_upper']
    bb_lower = latest['bb_lower']
    if current_price < bb_lower:
        reasoning.append("Price below BB lower (oversold)")
        signals.append(1)
        confidence_score += 1
    elif current_price > bb_upper:
        reasoning.append("Price above BB upper (overbought)")
        signals.append(-1)
        confidence_score += 1
    else:
        reasoning.append("Price within BB range")
        signals.append(0)
    
    # 6. ADX - Trend Strength
    adx = latest['adx']
    if adx > 25:
        reasoning.append(f"Strong trend (ADX: {adx:.1f})")
        confidence_score += 0.5
    else:
        reasoning.append(f"Weak trend (ADX: {adx:.1f})")
    
    # 7. CCI
    cci = latest['cci']
    if cci < -100:
        reasoning.append(f"CCI oversold: {cci:.1f}")
        signals.append(1)
    elif cci > 100:
        reasoning.append(f"CCI overbought: {cci:.1f}")
        signals.append(-1)
    
    # === KEPUTUSAN AKHIR ===
    total_score = sum(signals)
    max_score = len(signals) * 1.5  # Maximum possible score
    
    if total_score >= 3:
        action = "BUY"
        confidence = 0.5 + (total_score / max_score) * 0.5
    elif total_score <= -3:
        action = "SELL"
        confidence = 0.5 + (abs(total_score) / max_score) * 0.5
    else:
        action = "HOLD"
        confidence = 0.5
    
    # Cap confidence
    confidence = min(confidence, 0.95)
    
    # Calculate SL/TP
    sl, tp = calculate_sl_tp(df, action, mode)
    
    # Determine lot size
    if mode == 'scalping':
        lot = 0.01 if confidence < 0.7 else 0.02
    else:
        lot = 0.02 if confidence < 0.7 else 0.03
    
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
            "stoch_k": round(stoch_k, 2),
            "stoch_d": round(stoch_d, 2),
            "macd": round(macd, 4),
            "ema_20": round(ema_20, 2),
            "atr": round(latest['atr'], 2),
            "adx": round(adx, 2),
            "cci": round(cci, 2),
            "bb_width": round(latest['bb_width'], 4)
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