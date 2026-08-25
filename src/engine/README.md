# Technical analysis engine

Deterministic OHLCV math only. No API, Supabase, OpenAI, or trading decisions.

Priority: Accuracy > Transparency > Risk > Performance > Design.

## Input

Candles must already be loaded (`timestamp`, `open`, `high`, `low`, `close`, `volume`). One candle set feeds every indicator. Missing data is `null`, an empty array, or `DATA_UNAVAILABLE`. Nothing is estimated.

## No look-ahead

A snapshot at time `T` uses only candles with `timestamp <= T`. Confirmed swing highs/lows also need `lookback` bars on both sides, so the last `lookback` bars are never treated as pivots.

## EMA (20 / 50 / 200)

Standard EMA. First value is the SMA of the first `period` closes (at index `period - 1`). Then:

`EMA_t = close_t * k + EMA_{t-1} * (1 - k)` with `k = 2 / (period + 1)`.

Full JavaScript number precision. Insufficient bars → `null`.

## RSI 14

Wilder RSI. Needs `period + 1` closes. First average gain/loss is the SMA of the first 14 changes, then Wilder smoothing `(prev * 13 + current) / 14`.

- `avgLoss === 0` and `avgGain === 0` → 50
- `avgLoss === 0` and `avgGain > 0` → 100
- `avgGain === 0` and `avgLoss > 0` → 0

Otherwise `RSI = 100 - 100 / (1 + avgGain / avgLoss)`. Range is 0–100 from the formula, not a UI clamp.

## MACD (12 / 26 / 9)

`macd = EMA12 − EMA26`. Signal is EMA 9 of the MACD line (SMA seed on the first 9 MACD values). `histogram = macd − signal`.

## ATR 14

True range starts at the second bar: `max(high − low, |high − prevClose|, |low − prevClose|)`. First ATR is the SMA of the first 14 true ranges, then Wilder smoothing. Needs 15 candles.

## Volume

- `currentVolume`: last finite volume
- `averageVolume20`: mean of the last 20 finite volumes, else `null`
- `volumeRatio = currentVolume / averageVolume20`, or `null` if the average is missing or `0`
- `volumeTrend`: last 5 vs prior 5 finite volumes. Relative change vs 10% (`VOLUME_THRESHOLDS` in `technical/thresholds.ts`): `INCREASING` / `DECREASING` / `NEUTRAL` / `UNKNOWN`

## Support / resistance

Swing highs and lows with lookback 2. Nearby prices within 0.5% are clustered. `touches` is cluster size; `strength` equals `touches`. Support is below price, resistance above. Needs 20 candles; otherwise empty arrays.

## Classifications (not trades)

Trend: `BULLISH` if price > EMA20 > EMA50 (and EMA50 > EMA200 when EMA200 exists). `BEARISH` is the inverse. Else `NEUTRAL` or `UNKNOWN`.

Momentum: RSI + MACD histogram. `STRONG` if RSI ≥ 70 and histogram > 0. `WEAK` if RSI ≤ 30 and histogram < 0. Otherwise `POSITIVE` / `NEGATIVE` / `NEUTRAL` / `UNKNOWN`.

Volatility: `ATR / price`. Low < 1%, high > 3% (`VOLATILITY_THRESHOLDS`).

`technicalCondition`: `FAVORABLE` / `MIXED` / `UNFAVORABLE` / `UNKNOWN` from those three. This is not BUY or SELL.

## Data status

Copied from the candle result: `LIVE`, `CACHED`, `STALE`, `MOCK`, `UNAVAILABLE`. Mock is never shown as live.

## Data requirements

| Output | Minimum bars |
| --- | --- |
| Price structure | 1 (change needs 2) |
| RSI 14 / ATR 14 | 15 |
| MACD histogram | 34 |
| EMA 20 / 50 / 200 | 20 / 50 / 200 |
| Volume average / ratio | 20 finite volumes |
| Volume trend | 10 finite volumes |
| Support / resistance | 20 |
