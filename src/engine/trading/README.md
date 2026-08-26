# Deterministic trading / risk engine

Pure functions. Input: `TechnicalSnapshot` + user risk settings. Output: `TradingSetup`.
No API, Supabase, OpenAI, broker, or orders.

LONG / SHORT is a theoretical setup. NO_TRADE is a normal result.

## Score (0–100)

Weighted sum in `score.ts`. **Not a probability. Not expected return.** Do not show it as “80% chance”.

| Component | Weight |
| --- | --- |
| Trend | 20 |
| Momentum | 15 |
| EMA alignment | 15 |
| RSI | 10 |
| MACD | 15 |
| Volume | 10 |
| Volatility | 5 |
| Support / resistance | 10 |

Minimum score to allow LONG/SHORT: `MIN_SCORE_FOR_TRADE` (60). Below that → `NO_TRADE` / `NO_TECHNICAL_EDGE`.

## Direction (Phase 21 confirmation model)

LONG when:
- trend is BULLISH
- momentum is POSITIVE or STRONG
- **and at least one of:** EMA stack bullish **or** MACD histogram &gt; 0

SHORT is the inverse (BEARISH + NEGATIVE/WEAK + EMA bearish **or** MACD &lt; 0).

If all four of trend, momentum, EMA, and MACD agree → strong confirmation.
Directional trend without enough confirmation → NO_TRADE / watch (not VALID).
Neutral trend → never VALID.

Entry / stop / take-profit still come only from `buildRiskLevels` + `sizePosition` inside `buildTradingSetup()` — no second calculator.

## Entry

`currentPrice` from the snapshot. No invented prices.

## Stop

ATR stop: LONG `entry − ATR × 1.5`, SHORT `entry + ATR × 1.5` (`ATR_STOP_MULTIPLIER`).

If that stop would sit on the wrong side of the nearest support (LONG) or resistance (SHORT), the stop is moved just beyond that level. Distance must be at least `0.25 × ATR`. Otherwise `INVALID_STOP`.

## Take profit

`targetRR = user_settings.minimum_risk_reward`.

LONG: `entry + riskPerUnit × targetRR`. SHORT: `entry − riskPerUnit × targetRR`.

If a stronger level lies between entry and that target, TP is pulled to the level when R:R still meets the minimum; otherwise `INVALID_RR`.

## R:R

LONG: `riskPerUnit = entry − stop`, `rewardPerUnit = target − entry`.
SHORT: inverted. `riskPerUnit <= 0` → invalid.

## Risk and position size

Uses existing settings only:

- `capital` → account capital
- `risk_per_trade` → max risk fraction (UI 1% = DB 0.01)
- `max_portfolio_exposure` → max position fraction (UI 20% = DB 0.20)
- `minimum_risk_reward` → minimum and target R:R

```
riskAmount = capital × maxRiskPercent
riskBasedSize = riskAmount / riskPerUnit
maxSize = (capital × maxPositionPercent) / entry
positionSize = min(riskBasedSize, maxSize)
actualRisk = positionSize × riskPerUnit
```

`actualRisk` must stay `<= riskAmount` within `RISK_EPSILON` (1e-8). Never exceeds the user risk cap.

## Validation

`VALID` / `INVALID` / `REJECTED`.

Reject codes: `INSUFFICIENT_DATA`, `STALE_DATA`, `MOCK_DATA`, `INVALID_RISK`, `INVALID_ENTRY`, `INVALID_STOP`, `INVALID_TARGET`, `INVALID_RR`, `POSITION_SIZE_ZERO`, `RISK_LIMIT_EXCEEDED`, `NO_TECHNICAL_EDGE`, `NO_TRADE`.

- UNAVAILABLE → REJECTED, not estimated
- STALE → never VALID (`STALE_DATA`)
- MOCK → never VALID (`MOCK_DATA`); development only, not a live setup
- CACHED / LIVE → may be VALID if the rest passes

## No look-ahead

The setup reads only the snapshot. No future candles, news, or prices.

## Limits

The engine never calls a broker, never sends buy/sell, never moves capital.
