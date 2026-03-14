import { cn } from "../ui/utils";
import type { WorkflowStageId } from "../../types/workflow";

interface WorkflowProgressProps {
  currentStage: WorkflowStageId;
  summary: string;
  nextAction?: string;
  detail?: string;
  className?: string;
}

const stages: Array<{ id: WorkflowStageId; label: string }> = [
  { id: "search", label: "Search" },
  { id: "relevancy", label: "Relevancy" },
  { id: "validation", label: "Validation" },
  { id: "clients", label: "Clients" },
  { id: "details", label: "Details" },
];

export function WorkflowProgress({
  currentStage,
  summary,
  nextAction,
  detail,
  className,
}: WorkflowProgressProps) {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);

  return (
    <div
      className={cn(
        "mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStage;
          const isComplete = index < currentIndex;

          return (
            <span
              key={stage.id}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                isCurrent &&
                  "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-300",
                isComplete &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                !isCurrent &&
                  !isComplete &&
                  "border-gray-200 bg-gray-50 text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
              )}
            >
              {stage.label}
            </span>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{summary}</p>
          {nextAction ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              Next: {nextAction}
            </p>
          ) : null}
        </div>
        {detail ? (
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
