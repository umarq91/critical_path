"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CalendarSyncProgressDialog } from "@/app/(app)/calendar/calendar-sync-progress-dialog";
import { useGoogleCalendarSync, type SyncProgress } from "@/app/(app)/calendar/use-google-calendar-sync";
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

// A short wrap-up toast too, not just the dialog: the sync keeps running if the person moves to
// another page, and the toast is what tells them it finished.
function toastResult(progress: SyncProgress) {
  const synced = progress.pushedTasks + progress.pushedHolidays;
  if (progress.phase === "error") {
    toast.error(progress.error ?? "Google Calendar sync didn't finish");
    return;
  }
  if (progress.phase === "stopped") {
    toast.info(`Sync stopped after ${pluralize(synced, "event", "events")}. Run Sync again to continue.`);
    return;
  }
  if (progress.failed.length > 0) {
    toast.warning(`Synced ${pluralize(synced, "event", "events")}, ${progress.failed.length} couldn't be synced. Run Sync again to retry.`);
    return;
  }
  toast.success(synced > 0 ? `Synced ${pluralize(synced, "event", "events")} to Google Calendar` : "Google Calendar is already up to date");
}

// Sync pushes exactly what the Calendar's filters show (see planGoogleCalendarSync), and always
// asks first: with filters on it lists them, since a narrowed sync is easy to trigger without
// noticing a filter left on; with none it says everything is going (client request). Then a
// progress dialog takes over (calendar-sync-progress-dialog.tsx), since a first sync of every
// task can take a couple of minutes.
export const CalendarSyncButton = ({ filters, activeFilterLines, isSyncing, onSyncingChange }: CalendarSyncButtonProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sync = useGoogleCalendarSync();
  const isFiltered = activeFilterLines.length > 0;

  function runSync() {
    setConfirmOpen(false);
    onSyncingChange(true);
    void sync.start(filters).then((result) => {
      onSyncingChange(false);
      toastResult(result);
    });
  }

  const { processed, total, phase } = sync.progress;
  const buttonLabel = phase === "syncing" && total > 0 ? `Syncing ${processed}/${total}…` : "Syncing…";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="transition-colors duration-150"
        onClick={() => setConfirmOpen(true)}
        disabled={isSyncing}
        title={isFiltered ? "Push the tasks matching your filters to Google Calendar" : "Push all tasks to Google Calendar"}
      >
        <RefreshCw className={cn("size-4", sync.running && "animate-spin")} />
        {sync.running ? buttonLabel : "Sync to Google"}
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
              No filters are selected. <strong className="font-semibold text-foreground">ALL</strong> tasks on the platform and
              holidays will be synced to your Google Calendar.
            </>
          )
        }
        confirmLabel="Start sync"
        confirmVariant="default"
        pendingLabel="Starting…"
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
        <p className="text-xs text-muted-foreground">
          The first sync can take a few minutes. Keep this tab open until it finishes.
        </p>
      </ConfirmDialog>
      <CalendarSyncProgressDialog
        progress={sync.progress}
        stopping={sync.stopping}
        onStop={sync.stop}
        onClose={sync.reset}
      />
    </>
  );
};
