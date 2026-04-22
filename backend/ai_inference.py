# ai-service/ai_inference.py
import sys
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# ============================================
# KONFIGURASI
# ============================================
USE_MOCK = True

# ============================================
# FUNGSI AMBIL DATA HISTORIS (FIXED)
# ============================================
def get_historical_data(symbol, timeframe='1h', limit=200):
    """
    Ambil data historis (mock data untuk testing)
    """
    np.random.seed(42)
    
    # Generate price data realistis
    if 'XAU' in symbol.upper() or 'GOLD' in symbol.upper():
        base_price = 2000  # Gold
        volatility = 20
    else:
        base_price = 1.1000  # Forex
        volatility = 0.0010
    
    # Generate dates MANUAL (tanpa freq string)
    if timeframe.lower() in ['1h', 'h', '1hour']:
        hours_between = 1
    elif timeframe.lower() in ['4h', '4hour']:
        hours_between = 4
    elif timeframe.lower() in ['1d', 'd', '1day']:
        hours_between = 24
    elif timeframe.lower() in ['15m', 'm15']:
        hours_between = 0.25
    elif timeframe.lower() in ['30m', 'm30']:
        hours_between = 0.5
    else:
        hours_between = 1  # Default 1h
    
    # Generate dates dengan timedelta
    dates = []
    now = datetime.now()
    for i in range(limit):
        dates.append(now - timedelta(hours=hours_between * (limit - i - 1)))
    
    # Generate price data
    prices = [base_price]
    for i in range(1, limit):
        change = np.random.normal(0, volatility)
        prices.append(prices[-1] + change)
    
    prices = np.array(prices)
    
    # Buat OHLCV DataFrame
    df = pd.DataFrame({
        'timestamp': dates,
        'open': prices + np.random.normal(0, volatility/2, limit),
        'high': prices + np.abs(np.random.normal(0, volatility, limit)),
        'low': prices - np.abs(np.random.normal(0, volatility, limit)),
        'close': prices,
        'volume': np.random.uniform(100, 1000, limit)
    })
    
    return df

# ============================================
# TECHNICAL INDICATORS
# ============================================
def calculate_indicators(df):
    """Hitung semua technical indicators"""
    
    # 1. RSI (14 period)
    from ta.momentum import RSIIndicator
    df['rsi'] = RSIIndicator(close=df['close'], window=14).rsi()
    
    # 2. MACD
    from ta.trend import MACD
    macd = MACD(close=df['close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['macd_diff'] = macd.macd_diff()
    
    # 3. Moving Averages
    from ta.trend import SMAIndicator, EMAIndicator
    df['ema_20'] = EMAIndicator(close=df['close'], window=20).ema_indicator()
    df['ema_50'] = EMAIndicator(close=df['close'], window=50).ema_indicator()
    df['sma_200'] = SMAIndicator(close=df['close'], window=200).sma_indicator()
    
    # 4. Bollinger Bands
    from ta.volatility import BollingerBands
    bb = BollingerBands(close=df['close'])
    df['bb_high'] = bb.bollinger_hband()
    df['bb_mid'] = bb.bollinger_mavg()
    df['bb_low'] = bb.bollinger_lband()
    
    # 5. ATR (Average True Range)
    from ta.volatility import AverageTrueRange
    df['atr'] = AverageTrueRange(high=df['high'], low=df['low'], close=df['close'], window=14).average_true_range()
    
    # 6. Support/Resistance
    df['resistance'] = df['high'].rolling(window=20).max()
    df['support'] = df['low'].rolling(window=20).min()
    
    return df

# ============================================
# ANALISIS SIGNAL
# ============================================
def analyze_signal(df):
    """Analisis multi-indicator untuk keputusan trading"""
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    
    signals = []
    weights = []
    reasoning = []
    
    # ===== 1. RSI ANALYSIS =====
    if latest['rsi'] < 30:
        signals.append('BUY')
        weights.append(2)
        reasoning.append(f"RSI oversold: {latest['rsi']:.1f}")
    elif latest['rsi'] > 70:
        signals.append('SELL')
        weights.append(2)
        reasoning.append(f"RSI overbought: {latest['rsi']:.1f}")
    else:
        signals.append('HOLD')
        weights.append(1)
        reasoning.append(f"RSI neutral: {latest['rsi']:.1f}")
    
    # ===== 2. MACD ANALYSIS =====
    if latest['macd'] > latest['macd_signal'] and prev['macd'] <= prev['macd_signal']:
        signals.append('BUY')
        weights.append(3)
        reasoning.append("MACD bullish crossover")
    elif latest['macd'] < latest['macd_signal'] and prev['macd'] >= prev['macd_signal']:
        signals.append('SELL')
        weights.append(3)
        reasoning.append("MACD bearish crossover")
    else:
        signals.append('HOLD')
        weights.append(1)
        reasoning.append("MACD no signal")
    
    # ===== 3. MOVING AVERAGE ANALYSIS =====
    if latest['close'] > latest['ema_20'] > latest['ema_50']:
        signals.append('BUY')
        weights.append(2)
        reasoning.append("EMA uptrend")
    elif latest['close'] < latest['ema_20'] < latest['ema_50']:
        signals.append('SELL')
        weights.append(2)
        reasoning.append("EMA downtrend")
    else:
        signals.append('HOLD')
        weights.append(1)
        reasoning.append("EMA sideways")
    
    # ===== 4. BOLLINGER BANDS =====
    if latest['close'] < latest['bb_low']:
        signals.append('BUY')
        weights.append(2)
        reasoning.append("Price below BB lower band")
    elif latest['close'] > latest['bb_high']:
        signals.append('SELL')
        weights.append(2)
        reasoning.append("Price above BB upper band")
    else:
        signals.append('HOLD')
        weights.append(1)
        reasoning.append("BB neutral")
    
    # ===== 5. SUPPORT/RESISTANCE =====
    dist_to_support = (latest['close'] - latest['support']) / latest['close'] * 100
    dist_to_resistance = (latest['resistance'] - latest['close']) / latest['close'] * 100
    
    if dist_to_support < 1:
        signals.append('BUY')
        weights.append(2)
        reasoning.append(f"Near support ({dist_to_support:.2f}%)")
    elif dist_to_resistance < 1:
        signals.append('SELL')
        weights.append(2)
        reasoning.append(f"Near resistance ({dist_to_resistance:.2f}%)")
    else:
        signals.append('HOLD')
        weights.append(1)
        reasoning.append("Mid range")
    
    # ===== HITUNG KEPUTUSAN AKHIR =====
    buy_score = sum(w for s, w in zip(signals, weights) if s == 'BUY')
    sell_score = sum(w for s, w in zip(signals, weights) if s == 'SELL')
    total_score = buy_score + sell_score
    
    if buy_score > sell_score:
        action = 'BUY'
        confidence = buy_score / total_score
    elif sell_score > buy_score:
        action = 'SELL'
        confidence = sell_score / total_score
    else:
        action = 'HOLD'
        confidence = 0.5
    
    return action, confidence, reasoning

# ============================================
# HITUNG SL/TP DINAMIS
# ============================================
def calculate_sl_tp(df, action):
    """Hitung Stop Loss dan Take Profit dinamis"""
    latest = df.iloc[-1]
    current_price = latest['close']
    atr = latest['atr']
    
    # Multiplier berdasarkan symbol
    if 'XAU' in str(df.iloc[-1]).upper():
        atr_multiplier = 2.0
    else:
        atr_multiplier = 1.5
    
    if action == 'BUY':
        sl_distance = atr * atr_multiplier
        tp_distance = sl_distance * 2
        
        sl = min(current_price - sl_distance, latest['support'])
        tp = current_price + tp_distance
        
    elif action == 'SELL':
        sl_distance = atr * atr_multiplier
        tp_distance = sl_distance * 2
        
        sl = max(current_price + sl_distance, latest['resistance'])
        tp = current_price - tp_distance
    else:
        sl = 0
        tp = 0
    
    lot = 0.01
    
    return round(sl, 2), round(tp, 2), lot

# ============================================
# MAIN FUNCTION
# ============================================
def main():
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'EURUSD'
    
    print(f"🤖 AI analyzing {symbol}...", file=sys.stderr)
    
    try:
        # 1. Ambil data
        df = get_historical_data(symbol, '1h')
        
        # 2. Hitung indicators
        df = calculate_indicators(df)
        
        # 3. Analisis signal
        action, confidence, reasoning = analyze_signal(df)
        
        # 4. Hitung SL/TP
        sl, tp, lot = calculate_sl_tp(df, action)
        
        # 5. Format output
        result = {
            "symbol": symbol,
            "action": action,
            "confidence": round(confidence, 3),
            "sl": sl,
            "tp": tp,
            "lot": lot,
            "reasoning": reasoning,
            "current_price": round(df.iloc[-1]['close'], 2),
            "indicators": {
                "rsi": round(df.iloc[-1]['rsi'], 2),
                "macd": round(df.iloc[-1]['macd'], 4),
                "ema_20": round(df.iloc[-1]['ema_20'], 2),
                "atr": round(df.iloc[-1]['atr'], 2)
            }
        }
        
        print(json.dumps(result))
        
        # Debug log
        print(f"\n📊 Analysis for {symbol}:", file=sys.stderr)
        print(f"Action: {action}", file=sys.stderr)
        print(f"Confidence: {confidence:.1%}", file=sys.stderr)
        print(f"Price: {result['current_price']}", file=sys.stderr)
        print(f"SL: {sl} | TP: {tp}", file=sys.stderr)
        print(f"Reasoning:", file=sys.stderr)
        for r in reasoning:
            print(f"  - {r}", file=sys.stderr)
            
    except Exception as e:
        print(f"❌ Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        result = {
            "symbol": symbol,
            "action": "HOLD",
            "confidence": 0,
            "sl": 0,
            "tp": 0,
            "lot": 0.01,
            "error": str(e)
        }
        print(json.dumps(result))

if __name__ == "__main__":
    main()