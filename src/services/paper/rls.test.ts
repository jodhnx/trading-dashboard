import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_TABLES } from "@/types/database";

describe("paper trading RLS migration", () => {
  it("registers paper_accounts as private", () => {
    expect(PRIVATE_TABLES).toContain("paper_accounts");
    expect(PRIVATE_TABLES).toContain("paper_positions");
    expect(PRIVATE_TABLES).toContain("paper_trades");
  });

  it("creates paper_accounts and snapshots with owner-only RLS", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260825230000_paper_trading_phase12.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("create table public.paper_accounts");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("setup_snapshot jsonb");
    expect(sql).toContain("idx_paper_positions_open_symbol_side");
  });
});
