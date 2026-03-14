import * as React from "react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { }

const selectBaseClassName =
  "border-input bg-input-background text-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        data-slot="select"
        className={cn(
          selectBaseClassName,
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        data-slot="select-trigger"
        className={cn(
          selectBaseClassName,
          "appearance-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = ({ children }: { children?: React.ReactNode }) => {
  return <>{children}</>;
};

const SelectContent = ({ children }: { children: React.ReactNode; className?: string }) => {
  return <>{children}</>;
};

const SelectItem = ({
  value,
  children,
  className
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <option value={value} className={cn("bg-white dark:bg-zinc-900 text-gray-900 dark:text-white", className)}>
      {children}
    </option>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
