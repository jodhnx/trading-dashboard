import "server-only";

import { createMarketDataService } from "@/services/market/create-service";
import { displayNameFor, normalizeInternalSymbol } from "@/services/market/symbols";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import type { PortfolioSnapshot, PortfolioErrorCode } from "./types";
import {
  cashUpdateSchema,
  holdingCreateSchema,
  holdingPatchSchema,
  isSupportedPortfolioSymbol,
} from "./validation";
import { buildPortfolioSnapshot, valueHolding, type QuoteForValuation } from "./valuation";
import {
  deleteHolding,
  findAssetBySymbol,
  findHoldingById,
  getOrCreatePortfolio,
  insertHolding,
  listHoldings,
  updateHolding,
  updatePortfolioCash,
} from "./persistence";

export type PortfolioResult =
  | { ok: true; portfolio: PortfolioSnapshot }
  | { ok: false; code: PortfolioErrorCode; error: string };

export type HoldingMutationResult =
  | { ok: true; portfolio: PortfolioSnapshot }
  | { ok: false; code: PortfolioErrorCode; error: string };

async function quotesForSymbols(
  symbols: string[],
): Promise<Map<string, QuoteForValuation>> {
  const unique = [...new Set(symbols.map(normalizeInternalSymbol))];
  const service = createMarketDataService();
  const map = new Map<string, QuoteForValuation>();
  await Promise.all(
    unique.map(async (symbol) => {
      const result = await service.getQuote(symbol);
      map.set(symbol, {
        symbol,
        name: result.name,
        price: result.quote?.price ?? null,
        dataStatus: result.status,
        asOf: result.quote?.dataTimestamp.toISOString() ?? null,
        source: result.source,
      });
    }),
  );
  return map;
}

export async function getPortfolioSnapshot(input: {
  userId: string;
  email?: string | null;
}): Promise<PortfolioResult> {
  try {
    let currency = "EUR";
    try {
      const settings = await getOrCreateAccountSettings(
        input.userId,
        input.email ?? null,
      );
      currency = settings.baseCurrency;
    } catch {
      currency = "EUR";
    }

    const portfolio = await getOrCreatePortfolio({
      userId: input.userId,
      currency,
    });
    const holdings = await listHoldings({
      userId: input.userId,
      portfolioId: portfolio.id,
    });
    const quotes = await quotesForSymbols(holdings.map((item) => item.symbol));
    const valued = holdings.map((holding) =>
      valueHolding({
        holding,
        name: quotes.get(holding.symbol)?.name ?? displayNameFor(holding.symbol),
        quote: quotes.get(holding.symbol) ?? null,
      }),
    );

    return {
      ok: true,
      portfolio: buildPortfolioSnapshot({
        portfolioId: portfolio.id,
        currency: portfolio.currency || currency,
        cash: Number(portfolio.cash),
        holdings: valued,
        updatedAt: portfolio.updated_at,
      }),
    };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load portfolio.",
    };
  }
}

export async function addHolding(input: {
  userId: string;
  email?: string | null;
  body: unknown;
}): Promise<HoldingMutationResult> {
  const parsed = holdingCreateSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid holding.",
    };
  }
  if (!isSupportedPortfolioSymbol(parsed.data.symbol)) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "Symbol is not supported for portfolio tracking.",
    };
  }

  const asset = await findAssetBySymbol(parsed.data.symbol);
  if (!asset) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: "Unknown asset symbol.",
    };
  }

  const portfolio = await getOrCreatePortfolio({ userId: input.userId });
  const inserted = await insertHolding({
    userId: input.userId,
    portfolioId: portfolio.id,
    assetId: asset.id,
    quantity: parsed.data.quantity,
    averageEntryPrice: parsed.data.averageEntryPrice,
  });
  if (!inserted.ok) {
    if (inserted.code === "DUPLICATE_HOLDING") {
      return {
        ok: false,
        code: "DUPLICATE_HOLDING",
        error: "Holding for this asset already exists. Edit the existing holding.",
      };
    }
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Holding could not be added.",
    };
  }

  return getPortfolioSnapshot({ userId: input.userId, email: input.email });
}

export async function patchHolding(input: {
  userId: string;
  email?: string | null;
  holdingId: string;
  body: unknown;
}): Promise<HoldingMutationResult> {
  const parsed = holdingPatchSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid holding update.",
    };
  }

  const existing = await findHoldingById({
    userId: input.userId,
    holdingId: input.holdingId,
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Holding not found." };
  }

  const updated = await updateHolding({
    userId: input.userId,
    holdingId: input.holdingId,
    quantity: parsed.data.quantity,
    averageEntryPrice: parsed.data.averageEntryPrice,
  });
  if (!updated) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Holding could not be updated.",
    };
  }

  return getPortfolioSnapshot({ userId: input.userId, email: input.email });
}

export async function removeHolding(input: {
  userId: string;
  email?: string | null;
  holdingId: string;
}): Promise<HoldingMutationResult> {
  const existing = await findHoldingById({
    userId: input.userId,
    holdingId: input.holdingId,
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Holding not found." };
  }

  const deleted = await deleteHolding({
    userId: input.userId,
    holdingId: input.holdingId,
  });
  if (!deleted) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Holding could not be deleted.",
    };
  }

  return getPortfolioSnapshot({ userId: input.userId, email: input.email });
}

export async function setPortfolioCash(input: {
  userId: string;
  email?: string | null;
  body: unknown;
}): Promise<HoldingMutationResult> {
  const parsed = cashUpdateSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid cash amount.",
    };
  }

  const updated = await updatePortfolioCash({
    userId: input.userId,
    cash: parsed.data.cash,
  });
  if (!updated) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Cash could not be updated.",
    };
  }

  return getPortfolioSnapshot({ userId: input.userId, email: input.email });
}

export function httpStatusForPortfolioError(code: PortfolioErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_INPUT":
    case "DUPLICATE_HOLDING":
      return 400;
    case "NOT_FOUND":
      return 404;
    default:
      return 503;
  }
}
