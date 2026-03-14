import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "../ui/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-0.5 text-sm">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
