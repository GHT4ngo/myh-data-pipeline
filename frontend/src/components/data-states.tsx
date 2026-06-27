import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  error,
  onRetry,
  label = "Could not load data",
}: {
  error: unknown;
  onRetry: () => void;
  label?: string;
}) {
  const msg = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="font-mono text-xs text-muted-foreground break-all">{msg}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-surface-2/60 ${className}`}
      aria-hidden
    />
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-1/40"
      style={{ height }}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-2/30 via-transparent to-surface-2/30" />
    </div>
  );
}
