import * as React from "react";
import { cn } from "./utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked: controlledChecked, defaultChecked, onCheckedChange, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked || false);
    const isControlled = controlledChecked !== undefined;
    const isChecked = isControlled ? controlledChecked : internalChecked;

    const handleClick = () => {
      const newValue = !isChecked;
      if (!isControlled) {
        setInternalChecked(newValue);
      }
      onCheckedChange?.(newValue);
    };

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={isChecked}
        type="button"
        onClick={handleClick}
        className={cn(
          "peer inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-blue-600" : "bg-zinc-700",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-white ring-0 transition-transform",
            isChecked ? "translate-x-[calc(100%-2px)]" : "translate-x-0"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
