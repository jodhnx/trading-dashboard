import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getQuote = vi.fn();
const getOrCreateAccountSettings = vi.fn();
const getOrCreatePortfolio = vi.fn();
const listHoldings = vi.fn();
const findAssetBySymbol = vi.fn();
const insertHolding = vi.fn();
const findHoldingById = vi.fn();
const updateHolding = vi.fn();
const deleteHolding = vi.fn();
const updatePortfolioCash = vi.fn();

vi.mock("@/services/market/create-service", () => ({
  createMarketDataService: () => ({ getQuote }),
}));

vi.mock("@/lib/settings/service", () => ({
  getOrCreateAccountSettings: (...args: unknown[]) =>
    getOrCreateAccountSettings(...args),
}));

vi.mock("./persistence", () => ({
  getOrCreatePortfolio: (...args: unknown[]) => getOrCreatePortfolio(...args),
  listHoldings: (...args: unknown[]) => listHoldings(...args),
  findAssetBySymbol: (...args: unknown[]) => findAssetBySymbol(...args),
  insertHolding: (...args: unknown[]) => insertHolding(...args),
  findHoldingById: (...args: unknown[]) => findHoldingById(...args),
  updateHolding: (...args: unknown[]) => updateHolding(...args),
  deleteHolding: (...args: unknown[]) => deleteHolding(...args),
  updatePortfolioCash: (...args: unknown[]) => updatePortfolioCash(...args),
}));

import {
  addHolding,
  getPortfolioSnapshot,
  patchHolding,
  removeHolding,
} from "./service";

describe("portfolio service security and quotes", () => {
  beforeEach(() => {
    getQuote.mockReset();
    getOrCreateAccountSettings.mockReset();
    getOrCreatePortfolio.mockReset();
    listHoldings.mockReset();
    findAssetBySymbol.mockReset();
    insertHolding.mockReset();
    findHoldingById.mockReset();
    updateHolding.mockReset();
    deleteHolding.mockReset();
    updatePortfolioCash.mockReset();

    getOrCreateAccountSettings.mockResolvedValue({ baseCurrency: "EUR" });
    getOrCreatePortfolio.mockResolvedValue({
      id: "p1",
      user_id: "user-1",
      cash: 1000,
      currency: "EUR",
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });
  });

  it("dedupes market quote requests per symbol", async () => {
    listHoldings.mockResolvedValue([
      {
        id: "h1",
        portfolioId: "p1",
        userId: "user-1",
        assetId: "a1",
        symbol: "NVDA",
        quantity: 1,
        averageEntryPrice: 100,
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
      },
      {
        id: "h2",
        portfolioId: "p1",
        userId: "user-1",
        assetId: "a1b",
        symbol: "NVDA",
        quantity: 2,
        averageEntryPrice: 110,
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
      },
    ]);
    getQuote.mockResolvedValue({
      symbol: "NVDA",
      name: "NVIDIA",
      status: "LIVE",
      source: "twelve-data",
      quote: {
        price: 200,
        dataTimestamp: new Date("2026-08-25T12:00:00.000Z"),
      },
    });

    const result = await getPortfolioSnapshot({ userId: "user-1" });
    expect(result.ok).toBe(true);
    expect(getQuote).toHaveBeenCalledTimes(1);
    expect(getQuote).toHaveBeenCalledWith("NVDA");
  });

  it("rejects duplicate holdings", async () => {
    findAssetBySymbol.mockResolvedValue({
      id: "asset-nvda",
      symbol: "NVDA",
      name: "NVIDIA",
    });
    insertHolding.mockResolvedValue({ ok: false, code: "DUPLICATE_HOLDING" });
    const result = await addHolding({
      userId: "user-1",
      body: { symbol: "NVDA", quantity: 1, averageEntryPrice: 100 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DUPLICATE_HOLDING");
    }
  });

  it("blocks patch/delete when holding is not owned (cross-user)", async () => {
    findHoldingById.mockResolvedValue(null);

    const patched = await patchHolding({
      userId: "user-1",
      holdingId: "foreign",
      body: { quantity: 2 },
    });
    expect(patched.ok).toBe(false);
    if (!patched.ok) {
      expect(patched.code).toBe("NOT_FOUND");
    }
    expect(updateHolding).not.toHaveBeenCalled();

    const removed = await removeHolding({
      userId: "user-1",
      holdingId: "foreign",
    });
    expect(removed.ok).toBe(false);
    if (!removed.ok) {
      expect(removed.code).toBe("NOT_FOUND");
    }
    expect(deleteHolding).not.toHaveBeenCalled();
  });

  it("scopes findHoldingById via userId from session", async () => {
    findHoldingById.mockResolvedValue({
      id: "h1",
      portfolioId: "p1",
      userId: "user-1",
      assetId: "a1",
      symbol: "NVDA",
      quantity: 1,
      averageEntryPrice: 100,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    });
    updateHolding.mockResolvedValue({
      id: "h1",
      portfolio_id: "p1",
      user_id: "user-1",
      asset_id: "a1",
      quantity: 3,
      average_entry_price: 100,
      created_at: "2026-08-25T00:00:00.000Z",
      updated_at: "2026-08-25T00:00:00.000Z",
    });
    listHoldings.mockResolvedValue([]);
    getQuote.mockResolvedValue({
      symbol: "NVDA",
      name: "NVIDIA",
      status: "LIVE",
      source: "twelve-data",
      quote: null,
    });

    await patchHolding({
      userId: "user-1",
      holdingId: "h1",
      body: { quantity: 3 },
    });

    expect(findHoldingById).toHaveBeenCalledWith({
      userId: "user-1",
      holdingId: "h1",
    });
    expect(updateHolding).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", holdingId: "h1" }),
    );
  });
});
