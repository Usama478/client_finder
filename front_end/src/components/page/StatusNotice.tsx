import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "../ui/utils";

type StatusNoticeTone = "info" | "success" | "warning";

interface StatusNoticeProps {
  tone?: StatusNoticeTone;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

const toneStyles: Record<
  StatusNoticeTone,
  { container: string; icon: string; iconNode: ReactNode }
> = {
  info: {
    container:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
    iconNode: <Info className="h-4 w-4" />,
  },
  success: {
    container:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    iconNode: <CheckCircle2 className="h-4 w-4" />,
  },
  warning: {
    container:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    iconNode: <AlertTriangle className="h-4 w-4" />,
  },
};

export function StatusNotice({
  tone = "info",
  title,
  description,
  action,
  className,
}: StatusNoticeProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        styles.container,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
            styles.icon,
          )}
        >
          {styles.iconNode}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="mt-0.5 text-sm">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
