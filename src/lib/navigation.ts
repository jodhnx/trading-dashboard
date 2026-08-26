import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Newspaper,
  Settings,
  Target,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/daily-brief", label: "Daily Brief", icon: CalendarClock },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/positions", label: "Paper Positions", icon: Briefcase },
  { href: "/market", label: "Market", icon: LineChart },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/backtesting", label: "Backtesting", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];
