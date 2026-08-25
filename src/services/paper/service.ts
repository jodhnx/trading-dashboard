import "server-only";

import { buildTradingSetup } from "@/engine/trading/setup";
import { createMarketDataService } from "@/services/market/create-service";
import { displayNameFor, normalizeInternalSymbol } from "@/services/market/symbols";
import { getOrCreateAccountSettings } from "@/lib/settings/service";
import { toTradingRiskSettings } from "@/lib/settings/schema";
import type {
  PaperAccountSnapshot,
  PaperErrorCode,
  PaperTradeRecord,
  ValuedPaperPosition,
} from "./types";
import { paperOpenSchema } from "./validation";
import {
  aggregateEquity,
  cashAfterClose,
  evaluateExitTrigger,
  isUsableQuotePrice,
  realizedPnL,
  realizedPnLPercent,
} from "./calculations";
import { buildSetupSnapshot, isPaperTradeableSetup } from "./setup";
import {
  aggregatePaperDataStatus,
  sideFromSetupDirection,
  valuePaperPosition,
  type QuoteForPaper,
} from "./valuation";
import {
  closePositionRow,
  closeTradeRow,
  findAssetBySymbol,
  findDuplicateOpenPosition,
  findOpenPositionById,
  getOrCreatePaperAccount,
  insertOpenPosition,
  insertOpenTrade,
  listClosedTrades,
  listOpenPositions,
  sumRealizedPnL,
  updatePaperAccountCash,
} from "./persistence";
import type { PaperCloseReason } from "@/types/database";

export type PaperResult =
  | { ok: true; account: PaperAccountSnapshot }
  | { ok: false; code: PaperErrorCode; error: string };

async function quotesForSymbols(
  symbols: string[],
): Promise<Map<string, QuoteForPaper>> {
  const unique = [...new Set(symbols.map(normalizeInternalSymbol))];
  const service = createMarketDataService();
  const map = new Map<string, QuoteForPaper>();
  await Promise.all(
    unique.map(async (symbol) => {
      const result = await service.getQuote(symbol);
      map.set(symbol, {
        symbol,
        name: result.name,
        price: result.quote?.price ?? null,
        dataStatus: result.status,
      });
    }),
  );
  return map;
}

function mapClosedTrade(
  trade: Awaited<ReturnType<typeof listClosedTrades>>[number],
): PaperTradeRecord {
  return {
    id: trade.id,
    symbol: trade.symbol,
    name: displayNameFor(trade.symbol),
    side: trade.side,
    quantity: trade.quantity,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    realizedPnL: trade.pnl,
    realizedPnLPercent: trade.pnlPercent,
    closeReason: trade.closeReason,
    status: trade.status,
    setupScore: trade.setupScore,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
  };
}

async function buildAccountSnapshot(input: {
  userId: string;
}): Promise<PaperAccountSnapshot> {
  const account = await getOrCreatePaperAccount({ userId: input.userId });
  const open = await listOpenPositions({ userId: input.userId });
  const quotes = await quotesForSymbols(open.map((item) => item.symbol));
  const valued = open.map((position) =>
    valuePaperPosition({
      position,
      name: quotes.get(position.symbol)?.name ?? displayNameFor(position.symbol),
      quote: quotes.get(position.symbol) ?? null,
    }),
  );

  const realizedPnLTotal = await sumRealizedPnL({ userId: input.userId });
  const closedTrades = (await listClosedTrades({ userId: input.userId, limit: 100 })).map(
    mapClosedTrade,
  );

  const { invested, equity } = aggregateEquity({
    cashBalance: Number(account.cash_balance),
    openMarketValues: valued.map((item) => item.marketValue),
  });

  const unrealizedPnL =
    valued.some((item) => item.unrealizedPnL === null)
      ? null
      : valued.reduce((sum, item) => sum + (item.unrealizedPnL ?? 0), 0);

  return {
    accountId: account.id,
    startingBalance: Number(account.starting_balance),
    cashBalance: Number(account.cash_balance),
    equity,
    invested,
    unrealizedPnL,
    realizedPnL: realizedPnLTotal,
    openPositions: valued,
    closedTrades,
    dataStatus: aggregatePaperDataStatus(valued.map((item) => item.dataStatus)),
    updatedAt: account.updated_at,
  };
}

async function maybeAutoCloseTriggeredPositions(input: {
  userId: string;
  positions: ValuedPaperPosition[];
}): Promise<boolean> {
  let changed = false;
  for (const position of input.positions) {
    if (
      position.currentPrice === null ||
      position.stopLoss === null ||
      position.takeProfit === null
    ) {
      continue;
    }
    const trigger = evaluateExitTrigger({
      side: position.side,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      currentPrice: position.currentPrice,
    });
    if (!trigger) {
      continue;
    }
    const result = await executeClose({
      userId: input.userId,
      positionId: position.id,
      closeReason: trigger,
      exitPrice: position.currentPrice,
    });
    if (result.ok) {
      changed = true;
    }
  }
  return changed;
}

async function executeClose(input: {
  userId: string;
  positionId: string;
  closeReason: PaperCloseReason;
  exitPrice: number;
}): Promise<PaperResult> {
  const position = await findOpenPositionById({
    userId: input.userId,
    positionId: input.positionId,
  });
  if (!position) {
    return { ok: false, code: "NOT_FOUND", error: "Position not found." };
  }

  const account = await getOrCreatePaperAccount({ userId: input.userId });
  const pnl = realizedPnL({
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice: input.exitPrice,
    quantity: position.quantity,
  });
  const pnlPercent = realizedPnLPercent({
    side: position.side,
    entryPrice: position.entryPrice,
    exitPrice: input.exitPrice,
  });
  const nextCash = cashAfterClose({
    cashBalance: Number(account.cash_balance),
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    realizedPnL: pnl,
  });

  const closedAt = new Date().toISOString();
  const positionClosed = await closePositionRow({
    userId: input.userId,
    positionId: input.positionId,
    currentPrice: input.exitPrice,
  });
  if (!positionClosed) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "Position could not be closed.",
    };
  }

  const tradeClosed = await closeTradeRow({
    userId: input.userId,
    positionId: input.positionId,
    exitPrice: input.exitPrice,
    pnl,
    pnlPercent,
    closeReason: input.closeReason,
    closedAt,
  });
  if (!tradeClosed) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Trade record could not be closed.",
    };
  }

  const cashUpdated = await updatePaperAccountCash({
    userId: input.userId,
    accountId: account.id,
    cashBalance: nextCash,
  });
  if (!cashUpdated) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Paper cash could not be updated.",
    };
  }

  return { ok: true, account: await buildAccountSnapshot({ userId: input.userId }) };
}

export async function getPaperAccountSnapshot(input: {
  userId: string;
}): Promise<PaperResult> {
  try {
    let snapshot = await buildAccountSnapshot({ userId: input.userId });
    const autoClosed = await maybeAutoCloseTriggeredPositions({
      userId: input.userId,
      positions: snapshot.openPositions,
    });
    if (autoClosed) {
      snapshot = await buildAccountSnapshot({ userId: input.userId });
    }
    return { ok: true, account: snapshot };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load paper account.",
    };
  }
}

export async function openPaperTrade(input: {
  userId: string;
  email?: string | null;
  body: unknown;
}): Promise<PaperResult> {
  const parsed = paperOpenSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const symbol = normalizeInternalSymbol(parsed.data.symbol);
  const asset = await findAssetBySymbol(symbol);
  if (!asset) {
    return { ok: false, code: "INVALID_INPUT", error: "Unknown asset symbol." };
  }

  let settings;
  try {
    settings = await getOrCreateAccountSettings(input.userId, input.email ?? null);
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Settings unavailable.",
    };
  }

  const paperAccount = await getOrCreatePaperAccount({ userId: input.userId });
  const riskSettings = toTradingRiskSettings({
    capital: Number(paperAccount.cash_balance),
    riskPerTradePercent: settings.riskPerTradePercent,
    maxPositionPercent: settings.maxPositionPercent,
    minimumRiskReward: settings.minimumRiskReward,
  });

  const technical = await createMarketDataService().getTechnicalSnapshot(
    symbol,
    parsed.data.timeframe,
  );
  const quote = await createMarketDataService().getQuote(symbol);

  if (
    !isUsableQuotePrice(quote.quote?.price ?? null, quote.status) ||
    !isUsableQuotePrice(
      technical.snapshot.currentPrice,
      technical.snapshot.dataStatus,
    )
  ) {
    return {
      ok: false,
      code: "INVALID_TRADING_SETUP",
      error: "Market data is not live or cached enough to open a paper trade.",
    };
  }

  const setup = buildTradingSetup({
    snapshot: technical.snapshot,
    settings: riskSettings,
  });
  const tradeable = isPaperTradeableSetup(setup);
  if (!tradeable.ok) {
    return {
      ok: false,
      code: "INVALID_TRADING_SETUP",
      error: tradeable.reason,
    };
  }

  const side = sideFromSetupDirection(setup.direction);
  if (!side) {
    return {
      ok: false,
      code: "INVALID_TRADING_SETUP",
      error: "Setup direction is not tradable.",
    };
  }

  const duplicate = await findDuplicateOpenPosition({
    userId: input.userId,
    assetId: asset.id,
    side,
  });
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_OPEN_POSITION",
      error: "An open paper position for this asset and side already exists.",
    };
  }

  const positionValue = setup.positionValue!;
  if (Number(paperAccount.cash_balance) < positionValue) {
    return {
      ok: false,
      code: "INSUFFICIENT_CASH",
      error: "Insufficient paper cash for this position value.",
    };
  }

  const snapshot = buildSetupSnapshot({ setup, snapshot: technical.snapshot });
  const position = await insertOpenPosition({
    userId: input.userId,
    accountId: paperAccount.id,
    assetId: asset.id,
    side,
    quantity: setup.positionSize!,
    entryPrice: setup.entry!,
    stopLoss: setup.stopLoss!,
    takeProfit: setup.takeProfit!,
  });
  if (!position) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Paper position could not be created.",
    };
  }

  const trade = await insertOpenTrade({
    userId: input.userId,
    positionId: position.id,
    assetId: asset.id,
    side,
    entryPrice: setup.entry!,
    quantity: setup.positionSize!,
    riskAmount: setup.riskAmount!,
    stopLoss: setup.stopLoss!,
    takeProfit: setup.takeProfit!,
    setupScore: setup.score,
    positionValue,
    setupSnapshot: snapshot,
  });
  if (!trade) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Paper trade record could not be created.",
    };
  }

  const nextCash = Number(paperAccount.cash_balance) - positionValue;
  const cashUpdated = await updatePaperAccountCash({
    userId: input.userId,
    accountId: paperAccount.id,
    cashBalance: nextCash,
  });
  if (!cashUpdated) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Paper cash could not be updated.",
    };
  }

  return { ok: true, account: await buildAccountSnapshot({ userId: input.userId }) };
}

export async function closePaperPosition(input: {
  userId: string;
  positionId: string;
}): Promise<PaperResult> {
  const position = await findOpenPositionById({
    userId: input.userId,
    positionId: input.positionId,
  });
  if (!position) {
    return { ok: false, code: "NOT_FOUND", error: "Position not found." };
  }

  const quote = await createMarketDataService().getQuote(position.symbol);
  const price = quote.quote?.price ?? null;
  if (!isUsableQuotePrice(price, quote.status)) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: `Market data unavailable for ${position.symbol}.`,
    };
  }

  return executeClose({
    userId: input.userId,
    positionId: input.positionId,
    closeReason: "MANUAL",
    exitPrice: price!,
  });
}

export function httpStatusForPaperError(code: PaperErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_INPUT":
    case "INVALID_TRADING_SETUP":
    case "INSUFFICIENT_CASH":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "DUPLICATE_OPEN_POSITION":
    case "CONFLICT":
      return 409;
    default:
      return 503;
  }
}

export async function getOpenPaperPositions(input: {
  userId: string;
}): Promise<PaperResult> {
  return getPaperAccountSnapshot(input);
}

export async function getPaperTradeHistory(input: {
  userId: string;
}): Promise<
  | { ok: true; trades: PaperTradeRecord[] }
  | { ok: false; code: PaperErrorCode; error: string }
> {
  try {
    const trades = (await listClosedTrades({ userId: input.userId, limit: 200 })).map(
      mapClosedTrade,
    );
    return { ok: true, trades };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load trade history.",
    };
  }
}
