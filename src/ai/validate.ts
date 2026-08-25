import type {
  AnalysisErrorCode,
  AnalysisSetupReference,
  TradingAnalysisInput,
} from "./types";
import type { ParsedTradingAnalysis } from "./schemas";

const NUMBER_EPS = 1e-6;
const URL_RE = /https?:\/\/[^\s)"']+/gi;

export type BusinessValidationFailure = {
  ok: false;
  code: AnalysisErrorCode;
  reason: string;
};

export type BusinessValidationSuccess = {
  ok: true;
};

export type BusinessValidationResult =
  | BusinessValidationSuccess
  | BusinessValidationFailure;

function numbersMatch(
  expected: number | null,
  actual: number | null,
): boolean {
  if (expected === null && actual === null) {
    return true;
  }
  if (expected === null || actual === null) {
    return false;
  }
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return false;
  }
  return Math.abs(expected - actual) <= NUMBER_EPS;
}

export function setupReferencesMatch(
  expected: AnalysisSetupReference,
  actual: AnalysisSetupReference,
): boolean {
  return (
    numbersMatch(expected.entry, actual.entry) &&
    numbersMatch(expected.stopLoss, actual.stopLoss) &&
    numbersMatch(expected.takeProfit, actual.takeProfit) &&
    numbersMatch(expected.riskReward, actual.riskReward) &&
    numbersMatch(expected.positionSize, actual.positionSize)
  );
}

export function validateBusinessRules(
  output: ParsedTradingAnalysis,
  input: TradingAnalysisInput,
): BusinessValidationResult {
  const dataStatus = input.marketData.dataStatus;
  const setup = input.tradingSetup;
  const decision = output.decision;

  if (dataStatus === "UNAVAILABLE" && decision !== "NO_TRADE") {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      reason: "UNAVAILABLE data must be NO_TRADE",
    };
  }
  if (dataStatus === "STALE" && (decision === "BUY_SETUP" || decision === "SHORT_SETUP")) {
    return {
      ok: false,
      code: "STALE_DATA",
      reason: "STALE data cannot be BUY_SETUP or SHORT_SETUP",
    };
  }
  if (dataStatus === "MOCK" && (decision === "BUY_SETUP" || decision === "SHORT_SETUP")) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      reason: "MOCK data cannot be a live trading recommendation",
    };
  }
  if (setup.status !== "VALID" && (decision === "BUY_SETUP" || decision === "SHORT_SETUP")) {
    return {
      ok: false,
      code: "INVALID_SETUP",
      reason: "INVALID setup cannot be BUY_SETUP or SHORT_SETUP",
    };
  }
  if (decision === "BUY_SETUP") {
    if (setup.direction !== "LONG" || dataStatus !== "LIVE" || setup.status !== "VALID") {
      return {
        ok: false,
        code: "AI_ANALYSIS_INVALID",
        reason: "BUY_SETUP requires VALID LONG LIVE setup",
      };
    }
  }
  if (decision === "SHORT_SETUP") {
    if (setup.direction !== "SHORT" || dataStatus !== "LIVE" || setup.status !== "VALID") {
      return {
        ok: false,
        code: "AI_ANALYSIS_INVALID",
        reason: "SHORT_SETUP requires VALID SHORT LIVE setup",
      };
    }
  }

  const expectedRef = {
    entry: setup.entry,
    stopLoss: setup.stopLoss,
    takeProfit: setup.takeProfit,
    riskReward: setup.riskReward,
    positionSize: setup.positionSize,
  };
  if (!setupReferencesMatch(expectedRef, output.setupReference)) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      reason: "setupReference must copy the engine values",
    };
  }

  const allowedIds = new Set(input.relevantNews.map((item) => item.id));
  for (const id of output.usedNewsIds) {
    if (!allowedIds.has(id)) {
      return {
        ok: false,
        code: "AI_ANALYSIS_INVALID",
        reason: "usedNewsIds contains an unknown news id",
      };
    }
  }

  const allowedTitles = new Set(input.relevantNews.map((item) => item.title.trim()));
  const citedHeadlines = [
    ...output.supportingSignals,
    ...output.contradictingSignals,
  ];
  for (const signal of citedHeadlines) {
    const headline = signal.match(/^(?:Headline|News|Article)\s*:\s*(.+)$/i)?.[1]?.trim();
    if (headline && !allowedTitles.has(headline)) {
      return {
        ok: false,
        code: "AI_ANALYSIS_INVALID",
        reason: "output cites a news headline that was not in the input",
      };
    }
  }

  const allowedUrls = new Set(
    input.relevantNews.map((item) => item.sourceUrl).filter(Boolean),
  );
  const blobs = [
    output.summary,
    ...output.thesis,
    ...output.supportingSignals,
    ...output.contradictingSignals,
    ...output.risks,
    ...output.uncertainties,
  ].join("\n");
  const urls = blobs.match(URL_RE) ?? [];
  for (const url of urls) {
    if (!allowedUrls.has(url)) {
      return {
        ok: false,
        code: "AI_ANALYSIS_INVALID",
        reason: "output references a URL that was not in the news input",
      };
    }
  }

  if (/\d+\s*%\s*(Gewinn|win chance|profit chance|sicher)/i.test(blobs)) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      reason: "confidence must not be described as a win probability",
    };
  }

  return { ok: true };
}
