import { describe, expect, it } from "vitest";
import { analysisInput, longSetup } from "@/ai/test-fixtures";
import { computeAnalysisFingerprint } from "./fingerprint";

describe("computeAnalysisFingerprint", () => {
  it("is deterministic for the same inputs", () => {
    const payload = analysisInput({ setup: longSetup() });
    const first = computeAnalysisFingerprint(payload);
    const second = computeAnalysisFingerprint(payload);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when news IDs change", () => {
    const setup = longSetup();
    const base = analysisInput({ setup });
    const changed = analysisInput({
      setup,
      news: [
        {
          ...base.relevantNews[0],
          id: "news-other",
        },
      ],
    });
    expect(computeAnalysisFingerprint(base)).not.toBe(
      computeAnalysisFingerprint(changed),
    );
  });
});
