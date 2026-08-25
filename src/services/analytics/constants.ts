export const ANALYTICS_PRESETS = ["7D", "30D", "90D", "YTD", "1Y", "ALL"] as const;

export const ANALYTICS_DATASETS = ["paper", "journal", "backtest", "all"] as const;

export const ANALYTICS_SYMBOLS = ["ALL", "SPY", "QQQ", "NVDA", "BTC", "XAU", "USD"] as const;

export const SCORE_BUCKETS = [
  { label: "0–59", min: 0, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
] as const;

export const MIN_TRADES_FOR_SCORE_BUCKET = 1;

export const ANALYTICS_MAX_TRADES = 2000;
