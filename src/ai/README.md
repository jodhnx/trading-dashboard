# Structured trading analysis (Phase 8)

OpenAI is a **classification and explanation** layer. It does not invent prices,
indicators, news, or risk numbers. The deterministic trading engine remains the
only source of Entry, Stop Loss, Take Profit, Risk, Risk/Reward, and Position Size.

This module is **server-only** for live calls. Client Components must never import
`OPENAI_API_KEY`, `create-client.ts`, or `HttpOpenAiClient`.

## Input

`POST /api/ai/analyze` accepts `{ symbol, timeframe }` after auth. The server then
builds a compact JSON payload:

- `asset`, `timeframe`
- `marketData`: currentPrice, previousClose, change, changePercent, dataStatus, asOf
- `technicalSnapshot`: EMA/RSI/MACD/ATR/volume, support/resistance, trend, momentum, volatility, technicalCondition
- `tradingSetup`: direction, status, score, engine levels and size, reasons
- `relevantNews`: up to 10 items (title, summary, source, URL, publishedAt, category, relevance, sentiment, freshness)
- `userRiskSettings`

No raw candle arrays are sent.

## Output

Validated against `tradingAnalysisOutputSchema` and a strict OpenAI JSON schema:

- `decision`: `BUY_SETUP | SHORT_SETUP | WATCHLIST | NO_TRADE`
- `confidence`: 0–100
- `summary`, `thesis`, `risks`, `uncertainties`, `supportingSignals`, `contradictingSignals`
- `newsImpact`, `timeHorizon`
- `setupReference` (must copy the engine)
- `usedNewsIds` (must be a subset of input news ids)

## Decision enum

| Value | Meaning |
| --- | --- |
| `BUY_SETUP` | The provided **LONG** setup is acceptable as analysis. Not an order. |
| `SHORT_SETUP` | The provided **SHORT** setup is acceptable as analysis. Not an order. |
| `WATCHLIST` | Watch only. |
| `NO_TRADE` | Do not trade. Valid and often correct. |

## Confidence

Confidence is **not** a win probability or expected return. It measures how
consistent the provided data are with the chosen classification. The UI must
not present it as "85% Gewinnchance".

## Safety rules

- `tradingSetup.status != VALID` → never `BUY_SETUP` / `SHORT_SETUP`
- `dataStatus == STALE` → never `BUY_SETUP` / `SHORT_SETUP`
- `dataStatus == UNAVAILABLE` → `NO_TRADE` only (the API does not call OpenAI)
- `dataStatus == MOCK` → never a live BUY/SHORT recommendation
- `BUY_SETUP` requires VALID + LONG + LIVE
- `SHORT_SETUP` requires VALID + SHORT + LIVE
- `NO_TRADE` has priority when data are missing, stale, contradictory, or there is no edge
- The model must copy `setupReference` from the engine. Changed numbers fail business validation.

## Structured outputs

`HttpOpenAiClient` uses Chat Completions with

`response_format.type = json_schema` and `strict: true`.

Model: `OPENAI_MODEL` (fallback `gpt-4o-mini` only if unset). Not hardcoded at call sites.

## Validation pipeline

OpenAI → JSON parse → Zod schema → business validation → persist / return.

| Failure | Code |
| --- | --- |
| Invalid JSON / schema / copied numbers / unknown news | `AI_ANALYSIS_INVALID` |
| HTTP/network | `AI_UNAVAILABLE` |
| Timeout | `AI_TIMEOUT` |
| Missing market data (no OpenAI call) | `DATA_UNAVAILABLE` |
| Stale + BUY/SHORT from the model | `STALE_DATA` |
| Invalid engine setup + BUY/SHORT | `INVALID_SETUP` |

No fantasy fallback payloads.

## Persistence

Rows go to `ai_analyses` for the authenticated user (RLS). Stored fields include
decision, confidence, summary, thesis, risks, uncertainties, signals, news impact,
time horizon, setup_reference, input_snapshot (technical + setup + news ids/headlines + model + timestamp),
timeframe, and `is_mock`. No API keys.

`GET /api/ai/analyze?symbol=NVDA&limit=10` returns **own** analyses only.

## Cost control

- No OpenAI call on `/market/[symbol]` page load
- Explicit `POST /api/ai/analyze` from **Analyze Setup**
- Button disabled while in flight
- Server in-flight guard per user/symbol/timeframe
- Max 10 news items; no candle dumps

## Mock client

`MockOpenAiClient` (`isMock = true`) is for unit tests. Production
`createOpenAiClient()` only returns `HttpOpenAiClient` or `null`. Mock output is
never presented as a live trading recommendation.
