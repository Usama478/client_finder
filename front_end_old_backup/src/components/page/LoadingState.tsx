import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading...",
  className,
}: LoadingStateProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl p-8", className)}>
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400">{message}</p>
      </div>
    </div>
  );
}
