import type { BriefErrorCode } from "@/services/daily-brief/types";

export function httpStatusForBriefError(code: BriefErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_DATE":
    case "INVALID_INPUT":
      return 400;
    case "BRIEF_EXISTS":
      return 409;
    case "REQUEST_IN_PROGRESS":
      return 429;
    case "PERSISTENCE_FAILED":
    case "DATA_UNAVAILABLE":
      return 503;
    case "AI_UNAVAILABLE":
    case "AI_TIMEOUT":
    case "AI_ANALYSIS_INVALID":
      return 502;
    default:
      return 503;
  }
}
