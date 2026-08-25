"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/states/error-state";
import type { AccountSettings } from "@/lib/settings/schema";
import {
  parsePreferredAssets,
  settingsInputSchema,
} from "@/lib/settings/schema";
import {
  BASE_CURRENCIES,
  PREFERRED_MARKET_OPTIONS,
  TRADING_STYLE_LABELS,
} from "@/types/settings";
import { TRADING_STYLES } from "@/types/enums";

type SaveState = "idle" | "saving" | "saved" | "error";

export function SettingsForm({ initial }: { initial: AccountSettings }) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preferredAssetsText, setPreferredAssetsText] = useState(
    initial.preferredAssets.join(", "),
  );
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    initial.preferredMarkets,
  );

  const statusLabel = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "saved") return "Saved";
    if (saveState === "error") return "Error";
    return null;
  }, [saveState]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    setError(null);

    const form = new FormData(event.currentTarget);

    let preferredAssets: string[];
    try {
      preferredAssets = parsePreferredAssets(preferredAssetsText);
    } catch (parseError) {
      setSaveState("error");
      setError(
        parseError instanceof Error ? parseError.message : "Invalid assets list.",
      );
      return;
    }

    const parsed = settingsInputSchema.safeParse({
      displayName: String(form.get("displayName") ?? ""),
      baseCurrency: String(form.get("baseCurrency") ?? ""),
      capital: form.get("capital"),
      riskPerTradePercent: form.get("riskPerTradePercent"),
      maxDailyRiskPercent: form.get("maxDailyRiskPercent"),
      maxPositionPercent: form.get("maxPositionPercent"),
      minimumRiskReward: form.get("minimumRiskReward"),
      minimumAiScore: form.get("minimumAiScore"),
      maxOpenPositions: form.get("maxOpenPositions"),
      tradingStyle: String(form.get("tradingStyle") ?? ""),
      preferredMarkets: selectedMarkets,
      preferredAssets,
    });

    if (!parsed.success) {
      setSaveState("error");
      setError(parsed.error.issues[0]?.message ?? "Invalid settings.");
      return;
    }

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setSaveState("error");
        setError(payload?.error ?? "Could not save settings.");
        return;
      }

      setSaveState("saved");
    } catch {
      setSaveState("error");
      setError("Could not save settings.");
    }
  }

  function toggleMarket(market: string) {
    setSelectedMarkets((current) =>
      current.includes(market)
        ? current.filter((item) => item !== market)
        : [...current, market],
    );
    if (saveState === "saved") {
      setSaveState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <CardTitle>Account</CardTitle>
        {initial.email ? (
          <p className="text-xs text-muted">{initial.email}</p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              name="displayName"
              defaultValue={initial.displayName}
              required
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="baseCurrency">Base Currency</Label>
            <Select
              id="baseCurrency"
              name="baseCurrency"
              defaultValue={initial.baseCurrency}
            >
              {BASE_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Risk Management</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="capital">Capital</Label>
            <Input
              id="capital"
              name="capital"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              defaultValue={initial.capital}
              required
            />
          </div>
          <div>
            <Label htmlFor="riskPerTradePercent">Risk per Trade (%)</Label>
            <Input
              id="riskPerTradePercent"
              name="riskPerTradePercent"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={10}
              step="0.01"
              defaultValue={initial.riskPerTradePercent}
              required
            />
            <p className="mt-1 text-xs text-muted">UI percent, stored as a fraction (1% → 0.01).</p>
          </div>
          <div>
            <Label htmlFor="maxPositionPercent">Max Position Size (%)</Label>
            <Input
              id="maxPositionPercent"
              name="maxPositionPercent"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={100}
              step="0.01"
              defaultValue={initial.maxPositionPercent}
              required
            />
            <p className="mt-1 text-xs text-muted">
              Cap on notional vs capital. Uses existing max_portfolio_exposure.
            </p>
          </div>
          <div>
            <Label htmlFor="maxDailyRiskPercent">Maximum Daily Risk (%)</Label>
            <Input
              id="maxDailyRiskPercent"
              name="maxDailyRiskPercent"
              type="number"
              inputMode="decimal"
              min={0.01}
              max={50}
              step="0.01"
              defaultValue={initial.maxDailyRiskPercent}
              required
            />
          </div>
          <div>
            <Label htmlFor="minimumRiskReward">Minimum Risk/Reward</Label>
            <Input
              id="minimumRiskReward"
              name="minimumRiskReward"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.1"
              defaultValue={initial.minimumRiskReward}
              required
            />
          </div>
          <div>
            <Label htmlFor="minimumAiScore">Minimum AI Score</Label>
            <Input
              id="minimumAiScore"
              name="minimumAiScore"
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              step="0.1"
              defaultValue={initial.minimumAiScore}
              required
            />
          </div>
          <div>
            <Label htmlFor="maxOpenPositions">Maximum Open Positions</Label>
            <Input
              id="maxOpenPositions"
              name="maxOpenPositions"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              step="1"
              defaultValue={initial.maxOpenPositions}
              required
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Trading Preferences</CardTitle>
        <div>
          <Label htmlFor="tradingStyle">Trading Style</Label>
          <Select
            id="tradingStyle"
            name="tradingStyle"
            defaultValue={initial.tradingStyle}
          >
            {TRADING_STYLES.map((style) => (
              <option key={style} value={style}>
                {TRADING_STYLE_LABELS[style]}
              </option>
            ))}
          </Select>
        </div>
        <fieldset>
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            Preferred Markets
          </legend>
          <div className="flex flex-wrap gap-2">
            {PREFERRED_MARKET_OPTIONS.map((market) => {
              const checked = selectedMarkets.includes(market);
              return (
                <button
                  key={market}
                  type="button"
                  onClick={() => toggleMarket(market)}
                  className={
                    checked
                      ? "min-h-11 rounded-md border border-accent bg-accent/15 px-3 text-sm"
                      : "min-h-11 rounded-md border border-border px-3 text-sm text-muted"
                  }
                >
                  {market}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <Label htmlFor="preferredAssets">Preferred Assets</Label>
          <Input
            id="preferredAssets"
            name="preferredAssets"
            value={preferredAssetsText}
            onChange={(event) => setPreferredAssetsText(event.target.value)}
            placeholder="NVDA, SPY, BTC/USD"
          />
          <p className="mt-1 text-xs text-muted">Comma-separated symbols.</p>
        </div>
      </Card>

      {error ? <ErrorState title="Could not save" description={error} /> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : "Save settings"}
        </Button>
        {statusLabel && saveState !== "saving" ? (
          <span
            className={
              saveState === "saved" ? "text-sm text-positive" : "text-sm text-negative"
            }
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
    </form>
  );
}
