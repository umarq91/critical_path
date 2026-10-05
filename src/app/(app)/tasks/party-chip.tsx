"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { PartySummary } from "@/lib/party";

interface PartyChipProps {
  party: PartySummary;
  trailing?: ReactNode;
  className?: string;
  /** "sm" is the grid's read-only form: shorter pill, 11px type, so a wrapped list of several
   *  parties doesn't make every row tall. */
  size?: "default" | "sm";
}

// A named pill for one owner or person involved in the task grid. Name only, no avatar or
// department glyph (client request: the icons took width without telling anyone anything).
export const PartyChip = ({ party, trailing, className, size = "default" }: PartyChipProps) => {
  const isSmall = size === "sm";
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full border bg-card px-2 text-xs text-foreground",
        trailing && "pr-0.5",
        isSmall && "h-5 gap-1 px-1.5 text-overline font-normal tracking-normal",
        className
      )}
      title={party.isExternal ? `${party.name} · External` : party.name}
    >
      <span className="truncate">{party.name}</span>
      {trailing}
    </span>
  );
};
