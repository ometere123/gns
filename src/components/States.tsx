import type { ReactNode } from "react";
import { Card } from "./ui/Card";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <Card className="flex items-center justify-center text-muted">
      <span className="mr-3 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {message}
    </Card>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <Card className="border-red-200 bg-red-50/30">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-700">{message}</p>
        {action}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="text-center" padding="lg">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}
