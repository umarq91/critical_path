"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SyncResultItem } from "@/app/(app)/calendar/sync-items";
import { cn } from "@/lib/utils";

interface SyncResultListProps {
  title: string;
  items: SyncResultItem[];
  defaultOpen?: boolean;
  tone: "muted" | "error";
}

// A first sync's skipped list can run to hundreds of rows, so it's collapsed by default and
// scrolls inside a fixed height rather than stretching the dialog.
export const SyncResultList = ({ title, items, defaultOpen = false, tone }: SyncResultListProps) => {
  if (items.length === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-lg border border-border">
      <CollapsibleTrigger
        className={cn(
          "group flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium",
          tone === "error" ? "text-status-overdue-text" : "text-foreground"
        )}
      >
        {title} ({items.length})
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="max-h-40 overflow-y-auto border-t border-border px-3 py-1.5">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-baseline justify-between gap-3 py-1 text-xs">
              <span className="min-w-0 truncate text-foreground" title={item.name}>
                {item.name}
              </span>
              <span
                className={cn(
                  "max-w-[60%] shrink-0 text-right",
                  tone === "error" ? "text-status-overdue-text" : "text-muted-foreground"
                )}
              >
                {item.reason}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};
