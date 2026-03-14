import type { ReactNode } from "react";

import { cn } from "../ui/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  overline?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  overline,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {overline ? <div className="mb-4">{overline}</div> : null}
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">{title}</h1>
          {description ? (
            <p className="mt-2 text-gray-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
