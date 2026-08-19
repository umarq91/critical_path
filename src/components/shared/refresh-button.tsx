"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  label?: string;
}

export const RefreshButton = ({ onRefresh, isRefreshing, label = "Refresh" }: RefreshButtonProps) => {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onRefresh}
      disabled={isRefreshing}
      aria-label={label}
      title={label}
    >
      <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
    </Button>
  );
};
