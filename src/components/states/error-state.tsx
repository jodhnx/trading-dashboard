import { TriangleAlert } from "lucide-react";

export function ErrorState({
  title = "DATA UNAVAILABLE",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-1 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-negative">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        {title}
      </div>
      {description ? <p className="text-sm text-muted">{description}</p> : null}
    </div>
  );
}
