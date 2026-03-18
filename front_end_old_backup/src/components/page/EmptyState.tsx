import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "../ui/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
          {icon ?? <Inbox className="h-5 w-5" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">{description}</p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
