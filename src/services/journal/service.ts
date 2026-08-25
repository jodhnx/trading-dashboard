import "server-only";

import { normalizeInternalSymbol } from "@/services/market/symbols";
import type { PaperSetupSnapshot } from "@/services/paper/types";
import type {
  JournalEntryRecord,
  JournalErrorCode,
  JournalWorkspaceSnapshot,
} from "./types";
import {
  journalFromPaperTradeSchema,
  journalListQuerySchema,
  journalManualCreateSchema,
  journalPatchSchema,
} from "./validation";
import { computeJournalStatistics } from "./statistics";
import {
  deleteJournalEntry,
  findAssetBySymbol,
  findClosedPaperTrade,
  findJournalByPaperTradeId,
  findJournalEntryById,
  insertJournalEntry,
  listJournalEntries,
  updateJournalEntry,
} from "./persistence";

export type JournalResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: JournalErrorCode; error: string };

function reviewPatchFromBody(body: {
  setupRating?: number | null;
  executionRating?: number | null;
  disciplineRating?: number | null;
  emotionalState?: string | null;
  mistakeType?: string | null;
  lesson?: string | null;
  whatWentWell?: string | null;
  whatWentWrong?: string | null;
  notes?: string | null;
  tags?: string[];
}) {
  return {
    setup_rating: body.setupRating ?? null,
    execution_rating: body.executionRating ?? null,
    discipline_rating: body.disciplineRating ?? null,
    emotional_state: body.emotionalState ?? null,
    mistake_type: body.mistakeType ?? null,
    lesson: body.lesson ?? null,
    what_went_well: body.whatWentWell ?? null,
    what_went_wrong: body.whatWentWrong ?? null,
    notes: body.notes ?? null,
    tags: body.tags ?? [],
    setup_quality: body.setupRating ?? null,
    discipline_score: body.disciplineRating ?? null,
    lessons: body.lesson ?? null,
    mistakes: body.whatWentWrong ?? null,
  };
}

export async function getJournalWorkspace(input: {
  userId: string;
  query?: Record<string, string | undefined>;
}): Promise<JournalResult<JournalWorkspaceSnapshot>> {
  try {
    const parsed = journalListQuerySchema.safeParse(input.query ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: parsed.error.issues[0]?.message ?? "Invalid query.",
      };
    }
    const entries = await listJournalEntries({
      userId: input.userId,
      filters: parsed.data,
    });
    return {
      ok: true,
      data: {
        entries,
        statistics: computeJournalStatistics(entries),
      },
    };
  } catch {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Unable to load journal.",
    };
  }
}

export async function getJournalEntry(input: {
  userId: string;
  entryId: string;
}): Promise<JournalResult<JournalEntryRecord>> {
  const entry = await findJournalEntryById(input);
  if (!entry) {
    return { ok: false, code: "NOT_FOUND", error: "Journal entry not found." };
  }
  return { ok: true, data: entry };
}

export async function createManualJournalEntry(input: {
  userId: string;
  body: unknown;
}): Promise<JournalResult<JournalEntryRecord>> {
  const parsed = journalManualCreateSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid journal entry.",
    };
  }

  let assetId: string | null = null;
  let symbol: string | null = parsed.data.symbol ?? null;
  if (symbol) {
    const asset = await findAssetBySymbol(symbol);
    if (!asset) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        error: "Unknown asset symbol.",
      };
    }
    assetId = asset.id;
    symbol = asset.symbol;
  }

  const review = reviewPatchFromBody(parsed.data);
  const inserted = await insertJournalEntry({
    userId: input.userId,
    row: {
      user_id: input.userId,
      asset_id: assetId,
      symbol,
      side: parsed.data.side ?? null,
      entry_price: parsed.data.entryPrice ?? null,
      exit_price: parsed.data.exitPrice ?? null,
      quantity: parsed.data.quantity ?? null,
      realized_pnl: parsed.data.realizedPnL ?? null,
      realized_pnl_percent: parsed.data.realizedPnLPercent ?? null,
      entry_time: parsed.data.entryTime ?? null,
      exit_time: parsed.data.exitTime ?? null,
      ...review,
    },
  });
  if (!inserted) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Journal entry could not be created.",
    };
  }
  return { ok: true, data: inserted };
}

export async function createJournalFromPaperTrade(input: {
  userId: string;
  body: unknown;
}): Promise<JournalResult<JournalEntryRecord>> {
  const parsed = journalFromPaperTradeSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid journal request.",
    };
  }

  const existing = await findJournalByPaperTradeId({
    userId: input.userId,
    paperTradeId: parsed.data.paperTradeId,
  });
  if (existing) {
    return {
      ok: false,
      code: "CONFLICT",
      error: "A journal entry already exists for this paper trade.",
    };
  }

  const trade = await findClosedPaperTrade({
    userId: input.userId,
    paperTradeId: parsed.data.paperTradeId,
  });
  if (!trade) {
    return {
      ok: false,
      code: "NOT_FOUND",
      error: "Closed paper trade not found.",
    };
  }

  const review = reviewPatchFromBody(parsed.data);
  const inserted = await insertJournalEntry({
    userId: input.userId,
    row: {
      user_id: input.userId,
      paper_trade_id: trade.id,
      asset_id: trade.asset_id,
      symbol: trade.symbol,
      side: trade.side,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      quantity: trade.quantity,
      realized_pnl: trade.pnl,
      realized_pnl_percent: trade.pnl_percent,
      entry_time: trade.opened_at,
      exit_time: trade.closed_at,
      setup_score: trade.setup_score,
      setup_snapshot: trade.setup_snapshot as PaperSetupSnapshot | null,
      ...review,
    },
  });
  if (!inserted) {
    if (
      inserted === null &&
      (await findJournalByPaperTradeId({
        userId: input.userId,
        paperTradeId: parsed.data.paperTradeId,
      }))
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "A journal entry already exists for this paper trade.",
      };
    }
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Journal entry could not be created.",
    };
  }
  return { ok: true, data: inserted };
}

export async function patchJournalEntry(input: {
  userId: string;
  entryId: string;
  body: unknown;
}): Promise<JournalResult<JournalEntryRecord>> {
  const existing = await findJournalEntryById({
    userId: input.userId,
    entryId: input.entryId,
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Journal entry not found." };
  }

  const parsed = journalPatchSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: parsed.error.issues[0]?.message ?? "Invalid journal update.",
    };
  }

  const patch = reviewPatchFromBody(parsed.data);
  const updated = await updateJournalEntry({
    userId: input.userId,
    entryId: input.entryId,
    patch,
  });
  if (!updated) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Journal entry could not be updated.",
    };
  }
  return { ok: true, data: updated };
}

export async function removeJournalEntry(input: {
  userId: string;
  entryId: string;
}): Promise<JournalResult<null>> {
  const existing = await findJournalEntryById({
    userId: input.userId,
    entryId: input.entryId,
  });
  if (!existing) {
    return { ok: false, code: "NOT_FOUND", error: "Journal entry not found." };
  }
  const deleted = await deleteJournalEntry(input);
  if (!deleted) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      error: "Journal entry could not be deleted.",
    };
  }
  return { ok: true, data: null };
}

export function httpStatusForJournalError(code: JournalErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_INPUT":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 503;
  }
}

export async function getJournalLinksForPaperTrades(input: {
  userId: string;
}): Promise<Map<string, string>> {
  const { listJournalPaperTradeIds } = await import("./persistence");
  return listJournalPaperTradeIds(input);
}

export { normalizeInternalSymbol };
