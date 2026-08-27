import type { CatalogAsset } from "./types";
import { EXPANDED_CATALOG_ENTRIES } from "./catalog-expanded";
import { mergeCatalogEntries } from "./catalog-build";

function stock(
  symbol: string,
  name: string,
  exchange = "NASDAQ",
  tier: CatalogAsset["liquidityTier"] = "HIGH",
): CatalogAsset {
  return {
    symbol,
    name,
    assetType: "STOCK",
    assetClass: "STOCK",
    providerSymbol: symbol,
    exchange,
    country: "US",
    currency: "USD",
    tradable: true,
    providerMapped: true,
    liquidityTier: tier,
  };
}

function etf(
  symbol: string,
  name: string,
  opts?: { leveraged?: boolean; highRisk?: boolean; tier?: CatalogAsset["liquidityTier"] },
): CatalogAsset {
  return {
    symbol,
    name,
    assetType: "ETF",
    assetClass: "ETF",
    providerSymbol: symbol,
    exchange: "NYSEARCA",
    country: "US",
    currency: "USD",
    tradable: true,
    providerMapped: true,
    liquidityTier: opts?.tier ?? "HIGH",
    isLeveragedEtf: opts?.leveraged ?? false,
    isHighRisk: opts?.highRisk ?? opts?.leveraged ?? false,
  };
}

function crypto(symbol: string, name: string, tier: CatalogAsset["liquidityTier"] = "HIGH"): CatalogAsset {
  return {
    symbol,
    name,
    assetType: "CRYPTO",
    assetClass: "CRYPTO",
    providerSymbol: `${symbol}/USD`,
    exchange: "Crypto",
    country: "GLOBAL",
    currency: "USD",
    tradable: true,
    providerMapped: true,
    liquidityTier: tier,
    isHighRisk: symbol === "DOGE" || symbol === "SHIB",
  };
}

/** Broad market catalog — core symbols merged with Phase 27 expanded universe. */
const CORE_CATALOG: CatalogAsset[] = [
  etf("SPY", "S&P 500 ETF"),
  etf("QQQ", "Nasdaq 100 ETF"),
  etf("IWM", "Russell 2000 ETF"),
  etf("DIA", "Dow Jones ETF"),
  etf("VTI", "Total Stock Market ETF"),
  etf("VOO", "Vanguard S&P 500 ETF"),
  etf("IVV", "iShares Core S&P 500 ETF"),
  etf("XLK", "Technology Select Sector"),
  etf("XLF", "Financial Select Sector"),
  etf("XLE", "Energy Select Sector"),
  etf("XLV", "Health Care Select Sector"),
  etf("XLI", "Industrial Select Sector"),
  etf("XLY", "Consumer Discretionary Select Sector"),
  etf("XLP", "Consumer Staples Select Sector"),
  etf("XLU", "Utilities Select Sector"),
  etf("XLB", "Materials Select Sector"),
  etf("XLRE", "Real Estate Select Sector"),
  etf("XLC", "Communication Services Select Sector"),
  etf("SMH", "VanEck Semiconductor ETF"),
  etf("SOXX", "iShares Semiconductor ETF"),
  etf("ARKK", "ARK Innovation ETF", { tier: "MEDIUM", highRisk: true }),
  etf("TQQQ", "ProShares UltraPro QQQ", { leveraged: true, highRisk: true }),
  etf("SQQQ", "ProShares UltraPro Short QQQ", { leveraged: true, highRisk: true }),
  etf("UPRO", "ProShares UltraPro S&P500", { leveraged: true, highRisk: true }),
  stock("AAPL", "Apple"),
  stock("MSFT", "Microsoft"),
  stock("NVDA", "NVIDIA"),
  stock("AMZN", "Amazon"),
  stock("META", "Meta Platforms"),
  stock("GOOGL", "Alphabet Class A"),
  stock("GOOG", "Alphabet Class C"),
  stock("TSLA", "Tesla"),
  stock("AMD", "Advanced Micro Devices"),
  stock("AVGO", "Broadcom"),
  stock("NFLX", "Netflix"),
  stock("CRM", "Salesforce"),
  stock("ORCL", "Oracle"),
  stock("ADBE", "Adobe"),
  stock("INTC", "Intel"),
  stock("QCOM", "Qualcomm"),
  stock("TXN", "Texas Instruments"),
  stock("MU", "Micron Technology"),
  stock("AMAT", "Applied Materials"),
  stock("LRCX", "Lam Research"),
  stock("KLAC", "KLA Corporation"),
  stock("MRVL", "Marvell Technology"),
  stock("SNPS", "Synopsys"),
  stock("CDNS", "Cadence Design Systems"),
  stock("PANW", "Palo Alto Networks"),
  stock("CRWD", "CrowdStrike"),
  stock("SNOW", "Snowflake"),
  stock("PLTR", "Palantir Technologies"),
  stock("UBER", "Uber Technologies"),
  stock("ABNB", "Airbnb"),
  stock("SHOP", "Shopify"),
  stock("XYZ", "Block", "NYSE"),
  stock("PYPL", "PayPal"),
  stock("COIN", "Coinbase Global"),
  stock("HOOD", "Robinhood Markets", "NASDAQ", "MEDIUM"),
  stock("JPM", "JPMorgan Chase", "NYSE"),
  stock("BAC", "Bank of America", "NYSE"),
  stock("WFC", "Wells Fargo", "NYSE"),
  stock("GS", "Goldman Sachs", "NYSE"),
  stock("MS", "Morgan Stanley", "NYSE"),
  stock("C", "Citigroup", "NYSE"),
  stock("V", "Visa", "NYSE"),
  stock("MA", "Mastercard", "NYSE"),
  stock("AXP", "American Express", "NYSE"),
  stock("BLK", "BlackRock", "NYSE"),
  stock("SCHW", "Charles Schwab", "NYSE"),
  stock("UNH", "UnitedHealth Group", "NYSE"),
  stock("JNJ", "Johnson & Johnson", "NYSE"),
  stock("LLY", "Eli Lilly", "NYSE"),
  stock("PFE", "Pfizer", "NYSE"),
  stock("MRK", "Merck", "NYSE"),
  stock("ABBV", "AbbVie", "NYSE"),
  stock("TMO", "Thermo Fisher Scientific", "NYSE"),
  stock("ABT", "Abbott Laboratories", "NYSE"),
  stock("BMY", "Bristol-Myers Squibb", "NYSE"),
  stock("AMGN", "Amgen", "NASDAQ"),
  stock("GILD", "Gilead Sciences", "NASDAQ"),
  stock("ISRG", "Intuitive Surgical", "NASDAQ"),
  stock("COST", "Costco"),
  stock("WMT", "Walmart", "NYSE"),
  stock("HD", "Home Depot", "NYSE"),
  stock("LOW", "Lowe's", "NYSE"),
  stock("MCD", "McDonald's", "NYSE"),
  stock("SBUX", "Starbucks", "NASDAQ"),
  stock("NKE", "Nike", "NYSE"),
  stock("TGT", "Target", "NYSE"),
  stock("DIS", "Walt Disney", "NYSE"),
  stock("KO", "Coca-Cola", "NYSE"),
  stock("PEP", "PepsiCo", "NASDAQ"),
  stock("PG", "Procter & Gamble", "NYSE"),
  stock("CAT", "Caterpillar", "NYSE"),
  stock("DE", "Deere", "NYSE"),
  stock("BA", "Boeing", "NYSE"),
  stock("GE", "GE Aerospace", "NYSE"),
  stock("RTX", "RTX Corporation", "NYSE"),
  stock("HON", "Honeywell", "NASDAQ"),
  stock("UPS", "United Parcel Service", "NYSE"),
  stock("FDX", "FedEx", "NYSE"),
  stock("XOM", "Exxon Mobil", "NYSE"),
  stock("CVX", "Chevron", "NYSE"),
  stock("COP", "ConocoPhillips", "NYSE"),
  stock("SLB", "Schlumberger", "NYSE"),
  stock("FCX", "Freeport-McMoRan", "NYSE"),
  stock("NEM", "Newmont", "NYSE"),
  stock("SMCI", "Super Micro Computer", "NASDAQ", "MEDIUM"),
  stock("ARM", "Arm Holdings", "NASDAQ", "MEDIUM"),
  stock("DELL", "Dell Technologies", "NYSE", "MEDIUM"),
  stock("NET", "Cloudflare", "NYSE", "MEDIUM"),
  stock("DDOG", "Datadog", "NASDAQ", "MEDIUM"),
  stock("ZS", "Zscaler", "NASDAQ", "MEDIUM"),
  stock("MDB", "MongoDB", "NASDAQ", "MEDIUM"),
  stock("TEAM", "Atlassian", "NASDAQ", "MEDIUM"),
  stock("TTD", "The Trade Desk", "NASDAQ", "MEDIUM"),
  stock("ROKU", "Roku", "NASDAQ", "MEDIUM"),
  stock("RIVN", "Rivian Automotive", "NASDAQ", "MEDIUM"),
  stock("LCID", "Lucid Group", "NASDAQ", "LOW"),
  stock("SOFI", "SoFi Technologies", "NASDAQ", "MEDIUM"),
  stock("AFRM", "Affirm Holdings", "NASDAQ", "MEDIUM"),
  stock("UPST", "Upstart Holdings", "NASDAQ", "LOW"),
  stock("PATH", "UiPath", "NYSE", "MEDIUM"),
  stock("AI", "C3.ai", "NYSE", "LOW"),
  stock("IONQ", "IonQ", "NYSE", "LOW"),
  stock("RKLB", "Rocket Lab", "NASDAQ", "LOW"),
  stock("SOUN", "SoundHound AI", "NASDAQ", "LOW"),
  stock("MARA", "Marathon Digital", "NASDAQ", "LOW"),
  stock("RIOT", "Riot Platforms", "NASDAQ", "LOW"),
  stock("CLSK", "CleanSpark", "NASDAQ", "LOW"),
  stock("HIMS", "Hims & Hers Health", "NYSE", "LOW"),
  stock("CELH", "Celsius Holdings", "NASDAQ", "MEDIUM"),
  stock("DUOL", "Duolingo", "NASDAQ", "MEDIUM"),
  stock("GME", "GameStop", "NYSE", "MEDIUM"),
  stock("AMC", "AMC Entertainment", "NYSE", "LOW"),
  crypto("BTC", "Bitcoin"),
  crypto("ETH", "Ethereum"),
  crypto("SOL", "Solana"),
  crypto("XRP", "XRP"),
  crypto("LINK", "Chainlink", "MEDIUM"),
  crypto("BNB", "BNB"),
  crypto("DOGE", "Dogecoin", "MEDIUM"),
  crypto("ADA", "Cardano", "MEDIUM"),
  crypto("AVAX", "Avalanche", "MEDIUM"),
  crypto("MATIC", "Polygon", "MEDIUM"),
  crypto("DOT", "Polkadot", "MEDIUM"),
  crypto("ATOM", "Cosmos", "MEDIUM"),
  crypto("UNI", "Uniswap", "MEDIUM"),
  crypto("LTC", "Litecoin", "MEDIUM"),
  crypto("SHIB", "Shiba Inu", "LOW"),
  crypto("NEAR", "NEAR Protocol", "MEDIUM"),
  crypto("APT", "Aptos", "MEDIUM"),
  crypto("ARB", "Arbitrum", "MEDIUM"),
  crypto("OP", "Optimism", "MEDIUM"),
  crypto("INJ", "Injective", "LOW"),
  crypto("FIL", "Filecoin", "LOW"),
  crypto("ICP", "Internet Computer", "LOW"),
  {
    symbol: "XAU",
    name: "Gold",
    assetType: "COMMODITY",
    assetClass: "COMMODITY",
    providerSymbol: "XAU/USD",
    exchange: "FOREXCOM",
    country: "GLOBAL",
    currency: "USD",
    tradable: false,
    providerMapped: true,
    liquidityTier: "HIGH",
  },
  {
    symbol: "USD",
    name: "US Dollar Index",
    assetType: "INDEX",
    assetClass: "INDEX",
    providerSymbol: null,
    exchange: "CBOE",
    country: "US",
    currency: "USD",
    tradable: false,
    providerMapped: false,
    liquidityTier: "HIGH",
  },
];

export const BROAD_MARKET_CATALOG: CatalogAsset[] = mergeCatalogEntries(
  CORE_CATALOG,
  EXPANDED_CATALOG_ENTRIES,
);

export const REGIME_BENCHMARKS = ["SPY", "QQQ", "IWM", "DIA", "BTC", "ETH"] as const;

const TRADABLE_CATALOG = BROAD_MARKET_CATALOG.filter(
  (a) =>
    a.tradable &&
    a.providerMapped &&
    (a.assetClass === "STOCK" || a.assetClass === "ETF" || a.assetClass === "CRYPTO"),
);

export function getCatalogAsset(symbol: string): CatalogAsset | undefined {
  const upper = symbol.trim().toUpperCase();
  return BROAD_MARKET_CATALOG.find((a) => a.symbol === upper);
}

export function listTradableCatalog(): CatalogAsset[] {
  return TRADABLE_CATALOG;
}

export function listStockCatalog(): CatalogAsset[] {
  return TRADABLE_CATALOG.filter(
    (a) => a.assetClass === "STOCK" || a.assetClass === "ETF",
  );
}

export function listCryptoCatalog(): CatalogAsset[] {
  return TRADABLE_CATALOG.filter((a) => a.assetClass === "CRYPTO");
}

export function listEtfCatalog(): CatalogAsset[] {
  return TRADABLE_CATALOG.filter((a) => a.assetClass === "ETF");
}

export function catalogSize(): number {
  return TRADABLE_CATALOG.length;
}
