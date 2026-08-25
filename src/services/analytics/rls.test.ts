import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_TABLES } from "@/types/database";

describe("analytics security tables", () => {
  it("registers analytics source tables as private", () => {
    expect(PRIVATE_TABLES).toContain("paper_accounts");
    expect(PRIVATE_TABLES).toContain("paper_trades");
    expect(PRIVATE_TABLES).toContain("journal_entries");
    expect(PRIVATE_TABLES).toContain("backtest_runs");
  });

  it("keeps owner-only RLS on paper and journal tables", () => {
    const initSql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260824120000_init_schema.sql"),
      "utf8",
    );
    expect(initSql).toContain("create policy paper_trades_all_own");
    expect(initSql).toContain("create policy journal_entries_all_own");
    expect(initSql).toContain("user_id = auth.uid()");
  });
});
