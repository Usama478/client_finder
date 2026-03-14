import type { ComponentProps } from "react";

import { cn } from "./utils";

function Skeleton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-zinc-800", className)}
      {...props}
    />
  );
}

export { Skeleton };
