"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { syncGoogleCalendar } from "@/app/(app)/calendar/_actions";
import type { CalendarTaskFilterState } from "@/app/(app)/calendar/calendar-utils";
import { cn } from "@/lib/utils";

export interface CalendarSyncFilters extends CalendarTaskFilterState {
  countries: string[];
}

interface CalendarSyncButtonProps {
  filters: CalendarSyncFilters;
  /** One line per active filter, e.g. "Season: SS27, AW27". Empty means nothing is filtered. */
  activeFilterLines: string[];
  isSyncing: boolean;
  onSyncingChange: (isSyncing: boolean) => void;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Sync pushes exactly what the Calendar's filters show (see syncGoogleCalendar). With nothing
// filtered it syncs straight away, as it always has. With filters on it asks first, listing
// them, since a narrowed sync is easy to trigger without noticing a filter left on.
export const CalendarSyncButton = ({ filters, activeFilterLines, isSyncing, onSyncingChange }: CalendarSyncButtonProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isFiltered = activeFilterLines.length > 0;

  async function runSync() {
    onSyncingChange(true);
    const result = await syncGoogleCalendar(filters);
    onSyncingChange(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.tasksPushedCount === 0 && result.holidaysPushedCount === 0 && result.removedCount === 0) {
      toast.success(isFiltered ? "Nothing matching your filters needed syncing" : "Google Calendar is already up to date");
      return;
    }
    // Skipped tasks aren't a failure: a task already lives on a co-owner's calendar, and one
    // task maps to exactly one event (see _actions.ts). Reported so the count adds up.
    const skipped = result.skippedCount > 0 ? `, ${result.skippedCount} already on a co-owner's calendar` : "";
    const pushedItems = [
      result.tasksPushedCount > 0 ? pluralize(result.tasksPushedCount, "task", "tasks") : "",
      result.holidaysPushedCount > 0 ? pluralize(result.holidaysPushedCount, "holiday", "holidays") : "",
    ].filter(Boolean);
    const matching = isFiltered ? " matching your filters" : "";
    const pushed =
      pushedItems.length > 0 ? `Pushed ${pushedItems.join(" and ")}${matching} to Google Calendar${skipped}` : "";
    const removed =
      result.removedCount > 0
        ? `Removed ${pluralize(result.removedCount, "task", "tasks")} no longer yours from Google Calendar`
        : "";
    toast.success([pushed, removed].filter(Boolean).join(". "));
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="transition-colors duration-150"
        onClick={() => (isFiltered ? setConfirmOpen(true) : void runSync())}
        disabled={isSyncing}
        title={isFiltered ? "Push the tasks matching your filters to Google Calendar" : "Push your tasks to Google Calendar"}
      >
        <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
        {isSyncing ? "Syncing…" : "Sync to Google"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sync filtered tasks to Google?"
        description={`Only tasks and holidays matching these filters will be pushed. ${activeFilterLines.join(". ")}. Events already on Google Calendar stay there.`}
        confirmLabel="Sync"
        confirmVariant="default"
        pendingLabel="Syncing…"
        onConfirm={runSync}
      />
    </>
  );
};
