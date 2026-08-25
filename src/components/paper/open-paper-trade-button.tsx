"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SerializedTradingSetup } from "@/services/market/serialize";

type Props = {
  symbol: string;
  timeframe: string;
  setup: SerializedTradingSetup;
};

function canOpenPaperTrade(setup: SerializedTradingSetup): boolean {
  if (setup.direction === "NO_TRADE") return false;
  if (setup.status !== "VALID") return false;
  if (["STALE", "MOCK", "UNAVAILABLE"].includes(setup.dataStatus)) return false;
  const required = [
    setup.entry,
    setup.stopLoss,
    setup.takeProfit,
    setup.positionSize,
    setup.positionValue,
    setup.riskAmount,
  ];
  return required.every(
    (value) => value !== null && Number.isFinite(value) && value > 0,
  );
}

function unavailableReason(setup: SerializedTradingSetup): string {
  if (setup.direction === "NO_TRADE") {
    return "Setup direction is NO TRADE.";
  }
  if (setup.status !== "VALID") {
    return `Setup status is ${setup.status}.`;
  }
  if (setup.dataStatus === "STALE") {
    return "Market data is STALE.";
  }
  if (setup.dataStatus === "MOCK") {
    return "Mock data cannot open paper trades.";
  }
  if (setup.dataStatus === "UNAVAILABLE") {
    return "Market data is unavailable.";
  }
  return "Setup is missing required trade levels.";
}

export function OpenPaperTradeButton({ symbol, timeframe, setup }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const allowed = canOpenPaperTrade(setup);

  async function onOpen() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/paper/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        account?: unknown;
      } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Paper trade could not be opened.");
        return;
      }
      setSuccess("Paper trade opened.");
      router.refresh();
    } catch {
      setError("Paper trade could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs text-muted">
        SIMULATION ONLY — NO REAL ORDERS. Opens a paper position using the
        Trading Engine setup above.
      </p>
      {allowed ? (
        <Button type="button" disabled={busy} onClick={() => void onOpen()}>
          Open Paper Trade
        </Button>
      ) : (
        <div className="rounded-md border border-border bg-surface-2/40 px-3 py-2 text-sm text-muted">
          Paper trade unavailable — {unavailableReason(setup)}
        </div>
      )}
      {success ? (
        <p className="text-sm text-positive" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
