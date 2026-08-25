import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("journal RLS migration", () => {
  it("extends journal_entries with Phase 13 fields and unique paper trade constraint", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260825240000_journal_phase13.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("setup_rating");
    expect(sql).toContain("execution_rating");
    expect(sql).toContain("discipline_rating");
    expect(sql).toContain("setup_snapshot jsonb");
    expect(sql).toContain("idx_journal_entries_unique_paper_trade");
    expect(sql).toContain("journal_entries_set_updated_at");
  });
});
