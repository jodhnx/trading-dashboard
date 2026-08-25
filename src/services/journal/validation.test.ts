import { describe, expect, it } from "vitest";
import {
  journalFromPaperTradeSchema,
  journalManualCreateSchema,
  journalPatchSchema,
} from "./validation";

describe("journal validation", () => {
  it("accepts manual entries without trade facts", () => {
    expect(
      journalManualCreateSchema.safeParse({
        notes: "Review only",
        tags: ["process"],
      }).success,
    ).toBe(true);
  });

  it("rejects invalid ratings and negative quantity", () => {
    expect(
      journalManualCreateSchema.safeParse({ setupRating: 11 }).success,
    ).toBe(false);
    expect(
      journalManualCreateSchema.safeParse({ quantity: -1 }).success,
    ).toBe(false);
    expect(
      journalManualCreateSchema.safeParse({ quantity: Number.NaN }).success,
    ).toBe(false);
  });

  it("rejects too many tags and oversized text", () => {
    expect(
      journalManualCreateSchema.safeParse({
        tags: Array.from({ length: 21 }, (_, index) => `tag${index}`),
      }).success,
    ).toBe(false);
    expect(
      journalManualCreateSchema.safeParse({
        notes: "x".repeat(4001),
      }).success,
    ).toBe(false);
  });

  it("requires paper trade id for from-paper-trade schema", () => {
    expect(
      journalFromPaperTradeSchema.safeParse({
        paperTradeId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      journalFromPaperTradeSchema.safeParse({
        paperTradeId: "550e8400-e29b-41d4-a716-446655440000",
        setupRating: 7,
      }).success,
    ).toBe(true);
  });

  it("requires at least one field on patch", () => {
    expect(journalPatchSchema.safeParse({}).success).toBe(true);
    expect(
      journalPatchSchema.safeParse({ lesson: "Wait for confirmation" }).success,
    ).toBe(true);
  });
});
