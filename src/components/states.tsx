import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-primary">{icon}</div> : null}
      <h3 className="font-display text-xl">{title}</h3>
      {description ? <p className="max-w-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-destructive"
    >
      {message ?? "Something went wrong. Please try again."}
    </div>
  );
}
