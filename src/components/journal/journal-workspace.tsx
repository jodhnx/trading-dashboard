"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { MARKET_WATCHLIST } from "@/services/market/symbols";
import type {
  JournalEntryRecord,
  JournalWorkspaceSnapshot,
} from "@/services/journal/types";
import {
  formatJournalDate,
  formatJournalMoney,
  formatJournalPercent,
  formatRating,
  pnlClass,
} from "@/services/journal/view-model";

type Props = {
  initial: JournalWorkspaceSnapshot;
};

type Mode = "list" | "create" | "detail" | "edit";

export function JournalWorkspace({ initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paperTradeId = searchParams.get("paperTradeId");
  const entryParam = searchParams.get("entry");

  const [workspace, setWorkspace] = useState(initial);
  const [mode, setMode] = useState<Mode>(
    paperTradeId ? "create" : entryParam ? "detail" : "list",
  );
  const [selectedId, setSelectedId] = useState<string | null>(entryParam);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [sideFilter, setSideFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const selected = useMemo(
    () => workspace.entries.find((entry) => entry.id === selectedId) ?? null,
    [workspace.entries, selectedId],
  );

  async function reload(filters?: {
    symbol?: string;
    side?: string;
    tag?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.symbol) params.set("symbol", filters.symbol);
    if (filters?.side) params.set("side", filters.side);
    if (filters?.tag) params.set("tag", filters.tag);
    const response = await fetch(`/api/journal?${params.toString()}`);
    const payload = (await response.json().catch(() => null)) as
      | JournalWorkspaceSnapshot
      | { error?: string }
      | null;
    if (!response.ok || !payload || !("entries" in payload)) {
      setError(
        (payload as { error?: string } | null)?.error ??
          "Unable to load journal.",
      );
      return;
    }
    setWorkspace(payload);
  }

  async function onCreateFromPaperTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paperTradeId) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = formToReviewBody(form);
    try {
      const response = await fetch("/api/journal/from-paper-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperTradeId, ...body }),
      });
      const payload = (await response.json().catch(() => null)) as {
        entry?: JournalEntryRecord;
        error?: string;
      } | null;
      if (!response.ok || !payload?.entry) {
        setError(payload?.error ?? "Could not create journal entry.");
        return;
      }
      await reload();
      setSelectedId(payload.entry.id);
      setMode("detail");
      setFeedback("Journal entry created from paper trade.");
      router.replace("/journal");
    } catch {
      setError("Could not create journal entry.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      symbol: String(form.get("symbol") ?? "") || null,
      side: String(form.get("side") ?? "") || null,
      ...formToReviewBody(form),
    };
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        entry?: JournalEntryRecord;
        error?: string;
      } | null;
      if (!response.ok || !payload?.entry) {
        setError(payload?.error ?? "Could not create journal entry.");
        return;
      }
      await reload();
      setSelectedId(payload.entry.id);
      setMode("detail");
      setFeedback("Journal entry created.");
    } catch {
      setError("Could not create journal entry.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = formToReviewBody(form);
    try {
      const response = await fetch(`/api/journal/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as {
        entry?: JournalEntryRecord;
        error?: string;
      } | null;
      if (!response.ok || !payload?.entry) {
        setError(payload?.error ?? "Could not update journal entry.");
        return;
      }
      await reload();
      setMode("detail");
      setFeedback("Journal entry updated.");
    } catch {
      setError("Could not update journal entry.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(entryId: string) {
    if (!window.confirm("Delete this journal entry?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/journal/${entryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not delete journal entry.");
        return;
      }
      setSelectedId(null);
      setMode("list");
      await reload();
      setFeedback("Journal entry deleted.");
    } catch {
      setError("Could not delete journal entry.");
    } finally {
      setBusy(false);
    }
  }

  function applyFilters() {
    void reload({
      symbol: symbolFilter || undefined,
      side: sideFilter || undefined,
      tag: tagFilter || undefined,
    });
  }

  const stats = workspace.statistics;

  return (
    <div className="space-y-4">
      <header className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Trading Journal
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Review trades, identify mistakes, and record lessons.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode("create")}>
              New Journal Entry
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Total Entries" value={String(stats.totalEntries)} />
          <Metric label="Reviewed Trades" value={String(stats.reviewedTrades)} />
          <Metric label="Winning Trades" value={String(stats.winningTrades)} />
          <Metric label="Losing Trades" value={String(stats.losingTrades)} />
          <Metric
            label="Win Rate"
            value={
              stats.winRate === null
                ? "Unavailable"
                : `${stats.winRate.toFixed(1)}%`
            }
            hint="Historical descriptive metric only — not a prediction."
          />
        </div>
      </header>

      {feedback ? (
        <p className="text-sm text-positive" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? <ErrorState title="Error" description={error} /> : null}

      {mode === "list" ? (
        <>
          <Card className="space-y-3">
            <CardTitle>Filters</CardTitle>
            <div className="grid gap-3 sm:grid-cols-4">
              <Input
                placeholder="Symbol e.g. NVDA"
                value={symbolFilter}
                onChange={(event) => setSymbolFilter(event.target.value.toUpperCase())}
              />
              <Select
                value={sideFilter}
                onChange={(event) => setSideFilter(event.target.value)}
              >
                <option value="">All sides</option>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </Select>
              <Input
                placeholder="Tag"
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
              />
              <Button type="button" variant="ghost" onClick={applyFilters}>
                Apply
              </Button>
            </div>
          </Card>

          {workspace.entries.length === 0 ? (
            <EmptyState
              title="NO JOURNAL ENTRIES"
              description="Create your first journal entry or review a closed paper trade from Positions."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-surface text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">P&amp;L</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Setup</th>
                    <th className="px-3 py-2">Execution</th>
                    <th className="px-3 py-2">Discipline</th>
                    <th className="px-3 py-2">Tags</th>
                    <th className="px-3 py-2">Paper</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="cursor-pointer border-b border-border/70 hover:bg-surface-2/40 last:border-0"
                      onClick={() => {
                        setSelectedId(entry.id);
                        setMode("detail");
                      }}
                    >
                      <td className="px-3 py-2 font-medium">
                        {entry.symbol ?? "Manual"}
                      </td>
                      <td className="px-3 py-2">{entry.side ?? "—"}</td>
                      <td className={pnlClass(entry.realizedPnL)}>
                        {formatJournalMoney(entry.realizedPnL, { signed: true })}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatJournalDate(entry.exitTime ?? entry.createdAt)}
                      </td>
                      <td className="px-3 py-2">{formatRating(entry.setupRating)}</td>
                      <td className="px-3 py-2">
                        {formatRating(entry.executionRating)}
                      </td>
                      <td className="px-3 py-2">
                        {formatRating(entry.disciplineRating)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">
                        {entry.tags.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {entry.paperTradeId ? (
                          <Badge tone="accent">Linked</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {mode === "create" ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>
              {paperTradeId ? "Review Paper Trade" : "New Journal Entry"}
            </CardTitle>
            <Button type="button" variant="ghost" onClick={() => setMode("list")}>
              Back
            </Button>
          </div>
          {paperTradeId ? (
            <form onSubmit={onCreateFromPaperTrade} className="space-y-4">
              <p className="text-sm text-muted">
                Trade facts will be copied from the closed paper trade and remain
                read-only after creation.
              </p>
              <ReviewFields />
              <Button type="submit" disabled={busy}>
                Save Journal Entry
              </Button>
            </form>
          ) : (
            <form onSubmit={onCreateManual} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="symbol">Asset (optional)</Label>
                  <Select id="symbol" name="symbol" defaultValue="">
                    <option value="">Manual / no asset</option>
                    {MARKET_WATCHLIST.map((asset) => (
                      <option key={asset.symbol} value={asset.symbol}>
                        {asset.symbol}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="side">Side (optional)</Label>
                  <Select id="side" name="side" defaultValue="">
                    <option value="">—</option>
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </Select>
                </div>
              </div>
              <ReviewFields />
              <Button type="submit" disabled={busy}>
                Create Entry
              </Button>
            </form>
          )}
        </Card>
      ) : null}

      {mode === "detail" && selected ? (
        <JournalDetail
          entry={selected}
          onEdit={() => setMode("edit")}
          onDelete={() => void onDelete(selected.id)}
          onBack={() => setMode("list")}
        />
      ) : null}

      {mode === "edit" && selected ? (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Edit Journal Entry</CardTitle>
            <Button type="button" variant="ghost" onClick={() => setMode("detail")}>
              Cancel
            </Button>
          </div>
          <form onSubmit={onSaveEdit} className="space-y-4">
            <ReviewFields entry={selected} />
            <Button type="submit" disabled={busy}>
              Save Changes
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function JournalDetail({
  entry,
  onEdit,
  onDelete,
  onBack,
}: {
  entry: JournalEntryRecord;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="danger" onClick={onDelete}>
          Delete
        </Button>
        {entry.paperTradeId ? (
          <Link href="/positions" className="text-sm text-accent hover:underline">
            View Positions
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Trade Facts</CardTitle>
          <Fact label="Asset" value={entry.symbol ?? "Unavailable"} />
          <Fact label="Direction" value={entry.side ?? "Unavailable"} />
          <Fact label="Entry" value={formatJournalMoney(entry.entryPrice)} />
          <Fact label="Exit" value={formatJournalMoney(entry.exitPrice)} />
          <Fact label="Quantity" value={entry.quantity?.toString() ?? "Unavailable"} />
          <Fact
            label="P&amp;L"
            value={formatJournalMoney(entry.realizedPnL, { signed: true })}
          />
          <Fact
            label="P&amp;L %"
            value={formatJournalPercent(entry.realizedPnLPercent)}
          />
          <Fact label="Entry time" value={formatJournalDate(entry.entryTime)} />
          <Fact label="Exit time" value={formatJournalDate(entry.exitTime)} />
          <Fact
            label="Linked Paper Trade"
            value={entry.paperTradeId ?? "Not linked"}
          />
        </Card>

        <Card className="space-y-3">
          <CardTitle>Setup Review</CardTitle>
          <Fact label="Setup rating" value={formatRating(entry.setupRating)} />
          <Fact
            label="Engine score"
            value={
              entry.setupScore === null
                ? "Unavailable"
                : entry.setupScore.toFixed(1)
            }
          />
          <Fact
            label="Setup snapshot"
            value={
              entry.setupSnapshot
                ? `${entry.setupSnapshot.symbol} ${entry.setupSnapshot.timeframe}`
                : "Not recorded"
            }
          />
        </Card>

        <Card className="space-y-3">
          <CardTitle>Execution Review</CardTitle>
          <Fact label="Execution rating" value={formatRating(entry.executionRating)} />
          <Fact label="Discipline rating" value={formatRating(entry.disciplineRating)} />
          <Fact label="Emotional state" value={entry.emotionalState ?? "Not recorded"} />
          <Fact label="Mistake type" value={entry.mistakeType ?? "Not recorded"} />
        </Card>

        <Card className="space-y-3">
          <CardTitle>Reflection</CardTitle>
          <Fact label="What went well" value={entry.whatWentWell ?? "Not recorded"} />
          <Fact label="What went wrong" value={entry.whatWentWrong ?? "Not recorded"} />
          <Fact label="Lesson" value={entry.lesson ?? "Not recorded"} />
          <Fact label="Notes" value={entry.notes ?? "Not recorded"} />
          <Fact label="Tags" value={entry.tags.length ? entry.tags.join(", ") : "—"} />
        </Card>
      </div>
    </div>
  );
}

function ReviewFields({ entry }: { entry?: JournalEntryRecord }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Setup rating (0-10)" name="setupRating" defaultValue={entry?.setupRating} />
      <Field label="Execution rating (0-10)" name="executionRating" defaultValue={entry?.executionRating} />
      <Field label="Discipline rating (0-10)" name="disciplineRating" defaultValue={entry?.disciplineRating} />
      <Field label="Emotional state" name="emotionalState" defaultValue={entry?.emotionalState} />
      <Field label="Mistake type" name="mistakeType" defaultValue={entry?.mistakeType} />
      <Field label="Tags (comma-separated)" name="tags" defaultValue={entry?.tags.join(", ")} />
      <TextArea label="What went well" name="whatWentWell" defaultValue={entry?.whatWentWell} />
      <TextArea label="What went wrong" name="whatWentWrong" defaultValue={entry?.whatWentWrong} />
      <TextArea label="Lesson" name="lesson" defaultValue={entry?.lesson} />
      <TextArea label="Notes" name="notes" defaultValue={entry?.notes} />
    </div>
  );
}

function formToReviewBody(form: FormData) {
  const tagsRaw = String(form.get("tags") ?? "").trim();
  return {
    setupRating: parseOptionalNumber(form.get("setupRating")),
    executionRating: parseOptionalNumber(form.get("executionRating")),
    disciplineRating: parseOptionalNumber(form.get("disciplineRating")),
    emotionalState: emptyToNull(String(form.get("emotionalState") ?? "")),
    mistakeType: emptyToNull(String(form.get("mistakeType") ?? "")),
    whatWentWell: emptyToNull(String(form.get("whatWentWell") ?? "")),
    whatWentWrong: emptyToNull(String(form.get("whatWentWrong") ?? "")),
    lesson: emptyToNull(String(form.get("lesson") ?? "")),
    notes: emptyToNull(String(form.get("notes") ?? "")),
    tags: tagsRaw
      ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [],
  };
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
      {hint ? <p className="mt-1 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      />
    </div>
  );
}
