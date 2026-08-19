"use client";

import type { ReactNode } from "react";
import { RefreshButton } from "@/components/shared/refresh-button";
import { cn } from "@/lib/utils";

interface RefreshableSectionProps {
  title?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  children: ReactNode;
  className?: string;
}

// The non-table counterpart to DataTable's built-in onRefresh — wraps a stat-card row or
// side panel with its own isolated refresh icon, dimming just that section while its
// Server Action round trip is in flight.
export const RefreshableSection = ({ title, onRefresh, isRefreshing, children, className }: RefreshableSectionProps) => {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : <span />}
        <RefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />
      </div>
      <div className={cn("transition-opacity", isRefreshing && "pointer-events-none opacity-50")}>{children}</div>
    </div>
  );
};
