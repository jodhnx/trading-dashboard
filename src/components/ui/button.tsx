import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-accent text-background hover:bg-accent/90",
        variant === "ghost" &&
          "border border-border bg-transparent text-foreground hover:bg-surface-2",
        variant === "danger" && "bg-negative text-white hover:bg-negative/90",
        className,
      )}
      {...props}
    />
  );
}
