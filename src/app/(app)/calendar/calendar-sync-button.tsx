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
  /** One entry per active filter, e.g. Season → ["SS27", "AW27"]. Empty means nothing is filtered. */
  activeFilterLines: { title: string; labels: string[] }[];
  isSyncing: boolean;
  onSyncingChange: (isSyncing: boolean) => void;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Sync pushes exactly what the Calendar's filters show (see syncGoogleCalendar), and always
// asks first: with filters on it lists them, since a narrowed sync is easy to trigger without
// noticing a filter left on; with none it says everything is going (client request).
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
        onClick={() => setConfirmOpen(true)}
        disabled={isSyncing}
        title={isFiltered ? "Push the tasks matching your filters to Google Calendar" : "Push your tasks to Google Calendar"}
      >
        <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
        {isSyncing ? "Syncing…" : "Sync to Google"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isFiltered ? "Sync filtered tasks to Google Calendar?" : "Sync ALL tasks to Google Calendar?"}
        description={
          isFiltered ? (
            <>
              <strong className="font-semibold text-foreground">Only</strong> the tasks and holidays matching these
              filters will be synced:
            </>
          ) : (
            <>
              No filters are selected. <strong className="font-semibold text-foreground">ALL</strong> your tasks and
              holidays will be synced to your Google Calendar.
            </>
          )
        }
        confirmLabel="Sync"
        confirmVariant="default"
        pendingLabel="Syncing…"
        onConfirm={runSync}
      >
        {isFiltered ? (
          <>
            <dl className="flex flex-col divide-y divide-border-subtle rounded-lg border border-border">
              {activeFilterLines.map((line) => (
                <div key={line.title} className="flex flex-col gap-1.5 px-3.5 py-3">
                  <dt className="text-overline text-muted-foreground uppercase">{line.title}</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {line.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {label}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">Events already on your Google Calendar stay there.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
};
