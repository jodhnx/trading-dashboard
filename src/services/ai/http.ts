import type { AnalysisErrorCode } from "@/ai/types";

export function httpStatusForAnalysisError(code: AnalysisErrorCode): number {
  switch (code) {
    case "REQUEST_IN_PROGRESS":
      return 429;
    case "AI_ANALYSIS_INVALID":
    case "INVALID_SETUP":
    case "STALE_DATA":
      return 502;
    default:
      return 503;
  }
}
