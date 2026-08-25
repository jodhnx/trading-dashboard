"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function NewsRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const response = await fetch("/api/news/refresh", { method: "POST" });
              const body = (await response.json().catch(() => null)) as {
                error?: string;
              } | null;
              if (!response.ok) {
                setError(body?.error ?? "NEWS UNAVAILABLE");
                return;
              }
              router.refresh();
            } catch {
              setError("NEWS UNAVAILABLE");
            }
          });
        }}
      >
        {pending ? "Loading news…" : "Load news"}
      </Button>
      {error ? (
        <p className="text-sm font-medium text-negative">{error}</p>
      ) : null}
    </div>
  );
}
