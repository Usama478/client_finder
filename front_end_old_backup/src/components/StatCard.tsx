import type { ReactNode } from "react";

import { Card, CardContent } from "./ui/card";
import { cn } from "./ui/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  badge,
  subtitle,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-6">
        {(icon || badge) ? (
          <div className="mb-4 flex items-start justify-between gap-4">
            {icon ? (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-zinc-800">
                {icon}
              </div>
            ) : <div />}
            {badge}
          </div>
        ) : null}
        <div className="mb-1 text-sm text-gray-500 dark:text-zinc-400">{title}</div>
        <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
        {subtitle ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">{subtitle}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
