import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
          className
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
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
          className
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

const SelectContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
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
    <option value={value} className={cn("bg-zinc-900 text-white", className)}>
      {children}
    </option>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
