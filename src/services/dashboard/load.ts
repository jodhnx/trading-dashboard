import "server-only";

import { getAuthUser } from "@/lib/auth/session";
import {
  findBriefByDate,
  listBriefHistory,
  utcBriefDate,
} from "@/services/daily-brief";
import { toDashboardViewModel, buildHistoryItems, type DashboardViewModel } from "./view-model";

export type DashboardLoadResult =
  | {
      status: "ok";
      today: string;
      model: DashboardViewModel;
    }
  | {
      status: "empty";
      today: string;
      history: DashboardViewModel["history"];
    }
  | {
      status: "unauthorized";
    }
  | {
      status: "database_unavailable";
      today: string;
    };

/**
 * Stored-first dashboard load.
 * Only reads Supabase Daily Briefs — never OpenAI, NewsAPI, or Twelve Data.
 */
export async function loadDashboard(now: Date = new Date()): Promise<DashboardLoadResult> {
  const today = utcBriefDate(now);
  const user = await getAuthUser();
  if (!user) {
    return { status: "unauthorized" };
  }

  try {
    const [brief, history] = await Promise.all([
      findBriefByDate({ userId: user.id, briefDate: today, now }),
      listBriefHistory({ userId: user.id, limit: 14, now }),
    ]);

    if (!brief) {
      return {
        status: "empty",
        today,
        history: buildHistoryItems(history, today),
      };
    }

    return {
      status: "ok",
      today,
      model: toDashboardViewModel({ brief, history, today }),
    };
  } catch {
    return { status: "database_unavailable", today };
  }
}
