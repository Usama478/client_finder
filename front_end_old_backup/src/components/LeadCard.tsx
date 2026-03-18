import type { MouseEventHandler, ReactNode } from "react";
import { CheckSquare, Square } from "lucide-react";

import { Card, CardContent } from "./ui/card";
import { cn } from "./ui/utils";

interface LeadCardProps {
  title: string;
  titleTitle?: string;
  titleSuffix?: ReactNode;
  subtitle?: ReactNode;
  location?: ReactNode;
  badges?: ReactNode;
  status?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  selected?: boolean;
  onToggleSelect?: MouseEventHandler<HTMLButtonElement>;
  onClick?: () => void;
  dimmed?: boolean;
  className?: string;
  contentClassName?: string;
  footerClassName?: string;
}

export function LeadCard({
  title,
  titleTitle,
  titleSuffix,
  subtitle,
  location,
  badges,
  status,
  leading,
  actions,
  footer,
  selected = false,
  onToggleSelect,
  onClick,
  dimmed = false,
  className,
  contentClassName,
  footerClassName,
}: LeadCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-gray-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-900",
        onClick && "cursor-pointer",
        onClick && "hover:bg-gray-100 dark:hover:bg-zinc-800/50",
        selected && "border-blue-500",
        dimmed && "opacity-50 grayscale",
        className,
      )}
      onClick={onClick}
    >
      {onToggleSelect ? (
        <button
          type="button"
          className="absolute left-6 top-6 z-10 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect(event);
          }}
          aria-pressed={selected}
          aria-label={selected ? "Deselect business" : "Select business"}
        >
          {selected ? (
            <CheckSquare className="h-5 w-5 text-blue-500" />
          ) : (
            <Square className="h-5 w-5 text-zinc-500 transition-colors hover:text-gray-500 dark:text-zinc-400" />
          )}
        </button>
      ) : null}

      <CardContent
        className={cn(
          "p-6",
          onToggleSelect && "pl-16",
          footer && "flex h-full flex-col",
          contentClassName,
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-4",
            footer && "flex-1",
            actions && "sm:flex-row sm:items-start sm:justify-between",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className={cn(leading && "flex items-start gap-4")}>
              {leading ? (
                <div className="flex-shrink-0">{leading}</div>
              ) : null}

              <div className="min-w-0 flex-1">
                <h3
                  className={cn(
                    "text-gray-900 dark:text-white",
                    leading ? "mb-1 flex items-center gap-2 min-w-0" : "mb-2 text-lg",
                  )}
                >
                  <span className="truncate" title={titleTitle ?? title}>
                    {title}
                  </span>
                  {titleSuffix ? (
                    <span className="flex-shrink-0">{titleSuffix}</span>
                  ) : null}
                </h3>
                {subtitle ? (
                  <div className="text-sm text-gray-500 dark:text-zinc-400">
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>

            {location ? (
              <div className={cn("text-gray-500 dark:text-zinc-400", leading && "mt-4")}>
                {location}
              </div>
            ) : null}

            {badges ? (
              <div className="mt-4 flex flex-wrap gap-2">{badges}</div>
            ) : null}

            {status ? <div className="mt-3 flex">{status}</div> : null}
          </div>

          {actions ? (
            <div className="flex w-full flex-shrink-0 flex-col gap-2 sm:w-32">
              {actions}
            </div>
          ) : null}
        </div>

        {footer ? (
          <div
            className={cn(
              "mt-4 flex justify-end border-t border-gray-200 pt-4 dark:border-zinc-800",
              footerClassName,
            )}
          >
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
