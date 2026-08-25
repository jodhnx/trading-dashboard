"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { LogoutButton } from "@/components/auth/logout-button";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="border-b border-border px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Private
        </p>
        <p className="mt-1 text-sm font-semibold">Trading Desk</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-2">
        <LogoutButton />
      </div>
    </aside>
  );
}
