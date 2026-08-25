import { Header } from "@/components/shell/header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import type { ReactNode } from "react";

export function AppShell({
  title,
  marketProvider,
  supabaseConfigured,
  children,
}: {
  title: string;
  marketProvider: "twelve-data" | "mock" | "unavailable";
  supabaseConfigured: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={title}
          marketProvider={marketProvider}
          supabaseConfigured={supabaseConfigured}
        />
        <main className="flex-1 px-4 py-4 pb-20 md:px-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
