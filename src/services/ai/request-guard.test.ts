import { beforeEach, describe, expect, it } from "vitest";
import {
  analysisRequestKey,
  beginAnalysisRequest,
  endAnalysisRequest,
  resetAnalysisRequests,
} from "./request-guard";

describe("analysis request guard", () => {
  beforeEach(() => {
    resetAnalysisRequests();
  });

  it("blocks a duplicate in-flight key", () => {
    const key = analysisRequestKey("user-1", "NVDA", "1day");
    expect(beginAnalysisRequest(key)).toBe(true);
    expect(beginAnalysisRequest(key)).toBe(false);
    endAnalysisRequest(key);
    expect(beginAnalysisRequest(key)).toBe(true);
  });
});
