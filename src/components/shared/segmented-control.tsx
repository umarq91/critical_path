"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface SegmentedControlProps<TValue extends string> {
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: SegmentedControlOption<TValue>[];
  /** Names what the segments switch between, for screen readers. */
  label: string;
  className?: string;
}

// Two or three mutually exclusive views of the same chart (This Year / Weekly). A Select
// would hide the alternative behind a click; at this cardinality both options should be
// visible and one tap apart.
export const SegmentedControl = <TValue extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<TValue>) => {
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={isActive}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "h-7 px-3",
              isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
