import "server-only";

import { getAuthUser } from "@/lib/auth/session";
import {
  findBriefByDate,
  listBriefHistory,
  utcBriefDate,
} from "@/services/daily-brief";
import { listStoredOpportunities } from "@/services/opportunity/persistence";
import { boardFromStored } from "@/services/opportunity/board-from-stored";
import { toOpportunityCandidate } from "@/services/opportunity/present";
import {
  toDashboardViewModel,
  buildHistoryItems,
  type DashboardViewModel,
} from "./view-model";
import type { DashboardTradingSignal } from "@/components/dashboard/trading-signals-panel";

export type DashboardLoadResult =
  | {
      status: "ok";
      today: string;
      model: DashboardViewModel;
      bestStock: DashboardTradingSignal;
      bestCrypto: DashboardTradingSignal;
    }
  | {
      status: "empty";
      today: string;
      history: DashboardViewModel["history"];
      bestStock: DashboardTradingSignal;
      bestCrypto: DashboardTradingSignal;
    }
  | {
      status: "unauthorized";
    }
  | {
      status: "database_unavailable";
      today: string;
    };

function toSignal(
  candidate: ReturnType<typeof toOpportunityCandidate> | null,
): DashboardTradingSignal {
  if (!candidate || !candidate.actionable) return null;
  return {
    symbol: candidate.symbol,
    direction: candidate.direction,
    quality: candidate.quality,
    price: candidate.price,
    entry: candidate.entry,
    stop: candidate.stop,
    tp1: candidate.tp1,
    riskReward: candidate.riskReward,
    actionLabel: candidate.actionLabel,
  };
}

/**
 * Stored-first dashboard load.
 * Daily Brief + stored opportunities — never OpenAI/NewsAPI/Twelve Data on load.
 */
export async function loadDashboard(
  now: Date = new Date(),
): Promise<DashboardLoadResult> {
  const today = utcBriefDate(now);
  const user = await getAuthUser();
  if (!user) {
    return { status: "unauthorized" };
  }

  try {
    const [brief, history, opportunities] = await Promise.all([
      findBriefByDate({ userId: user.id, briefDate: today, now }),
      listBriefHistory({ userId: user.id, limit: 14, now }),
      listStoredOpportunities({ userId: user.id, briefDate: today, limit: 40 }),
    ]);

    const board = boardFromStored(opportunities);
    const bestStock = toSignal(
      board.bestStock ? toOpportunityCandidate(board.bestStock) : null,
    );
    const bestCrypto = toSignal(
      board.bestCrypto ? toOpportunityCandidate(board.bestCrypto) : null,
    );

    if (!brief) {
      return {
        status: "empty",
        today,
        history: buildHistoryItems(history, today),
        bestStock,
        bestCrypto,
      };
    }

    return {
      status: "ok",
      today,
      model: toDashboardViewModel({ brief, history, today }),
      bestStock,
      bestCrypto,
    };
  } catch {
    return { status: "database_unavailable", today };
  }
}
