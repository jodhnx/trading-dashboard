import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRIVATE_TABLES } from "@/types/database";

describe("portfolio RLS migration", () => {
  it("keeps portfolios private", () => {
    expect(PRIVATE_TABLES).toContain("portfolios");
    expect(PRIVATE_TABLES).toContain("portfolio_holdings");
  });

  it("enables owner-only RLS policies", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260825220000_portfolio_phase11.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("user_id = auth.uid()");
    expect(sql).toContain("unique (portfolio_id, asset_id)");
    expect(sql).toContain("create table public.portfolios");
    expect(sql).toContain("create table public.portfolio_holdings");
  });
});
