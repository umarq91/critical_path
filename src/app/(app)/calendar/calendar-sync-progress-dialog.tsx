"use client";

import { CircleAlert, CircleCheck, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { isSyncRunning, type SyncProgress } from "@/app/(app)/calendar/use-google-calendar-sync";
import { SyncResultList } from "@/app/(app)/calendar/sync-result-list";
import { cn } from "@/lib/utils";

interface CalendarSyncProgressDialogProps {
  progress: SyncProgress;
  stopping: boolean;
  onStop: () => void;
  onClose: () => void;
}

function remainingTimeLabel({ processed, total, startedAt }: SyncProgress) {
  if (!startedAt || processed === 0) return "Estimating time left…";
  const msPerItem = (Date.now() - startedAt) / processed;
  const seconds = Math.ceil((msPerItem * (total - processed)) / 1000);
  if (seconds < 60) return "Less than a minute left";
  return `About ${Math.ceil(seconds / 60)} min left`;
}

function titleFor(progress: SyncProgress) {
  if (progress.phase === "planning") return "Preparing sync…";
  if (progress.phase === "syncing") return "Syncing to Google Calendar";
  if (progress.phase === "stopped") return "Sync stopped";
  if (progress.phase === "error") return "Sync didn't finish";
  if (progress.total === 0) return "Already up to date";
  return progress.failed.length > 0 ? "Sync finished with errors" : "Sync complete";
}

function descriptionFor(progress: SyncProgress) {
  if (progress.phase === "planning") return "Checking which tasks and holidays need updating. This takes a few seconds.";
  if (progress.phase === "syncing") return "Adding and updating events in your Critical Path Calendar.";
  if (progress.phase === "stopped" || progress.phase === "error") {
    return "Run Sync again to continue. Anything already synced is skipped, so it picks up where it stopped.";
  }
  if (progress.total === 0) return "Every task and holiday is already on your Google Calendar.";
  return "Your Critical Path Calendar in Google is up to date.";
}

const Stat = ({ label, value, className }: { label: string; value: number; className: string }) => (
  <div className={cn("flex flex-col gap-0.5 rounded-lg px-3 py-2.5", className)}>
    <span className="text-xl font-semibold tabular-nums">{value}</span>
    <span className="text-xs font-medium">{label}</span>
  </div>
);

// Open for exactly as long as there's a sync to show (any phase but idle), and not dismissable
// while it runs: closing it would hide the only thing telling the person to keep the tab open.
// Stop is the way out, and it finishes the batch in flight first. Visibility deliberately has
// no state of its own: the confirm dialog closing in the same click used to send this one a
// close request, which hid it mid-sync.
export const CalendarSyncProgressDialog = ({ progress, stopping, onStop, onClose }: CalendarSyncProgressDialogProps) => {
  const running = isSyncRunning(progress.phase);
  const percent = progress.total === 0 ? 100 : Math.round((progress.processed / progress.total) * 100);
  const synced = progress.pushedTasks + progress.pushedHolidays;

  return (
    <Dialog
      open={progress.phase !== "idle"}
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next && !running) onClose();
      }}
    >
      <DialogContent showCloseButton={!running} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {running ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
            {progress.phase === "done" && progress.failed.length === 0 ? (
              <CircleCheck className="size-4 text-status-complete-base" />
            ) : null}
            {progress.phase === "error" || (progress.phase === "done" && progress.failed.length > 0) ? (
              <CircleAlert className="size-4 text-status-overdue-base" />
            ) : null}
            {titleFor(progress)}
          </DialogTitle>
          <DialogDescription>{descriptionFor(progress)}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-5">
          {running ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-status-overdue-base/40 bg-status-overdue-soft px-3 py-2.5 text-status-overdue-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p className="text-sm">
                <strong className="font-semibold">Do not close or refresh this tab.</strong> The sync stops if you do.
                You can use other tabs while it runs.
              </p>
            </div>
          ) : null}

          {progress.phase === "error" && progress.error ? (
            <p className="rounded-lg bg-status-overdue-soft px-3 py-2.5 text-sm text-status-overdue-text">{progress.error}</p>
          ) : null}

          {progress.phase !== "planning" && progress.total > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-foreground tabular-nums">
                  {progress.processed} / {progress.total} done
                </span>
                <span className="text-muted-foreground tabular-nums">{percent}%</span>
              </div>
              <Progress value={percent} />
              {progress.phase === "syncing" ? (
                <span className="text-xs text-muted-foreground">{remainingTimeLabel(progress)}</span>
              ) : null}
            </div>
          ) : null}

          {progress.phase === "planning" ? <Progress value={null} /> : null}

          {progress.phase !== "planning" ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Synced" value={synced} className="bg-status-complete-soft text-status-complete-text" />
              <Stat label="Skipped" value={progress.skipped.length} className="bg-muted text-muted-foreground" />
              <Stat
                label="Errors"
                value={progress.failed.length}
                className={
                  progress.failed.length > 0
                    ? "bg-status-overdue-soft text-status-overdue-text"
                    : "bg-muted text-muted-foreground"
                }
              />
            </div>
          ) : null}

          {progress.removed > 0 ? (
            <p className="text-xs text-muted-foreground">
              Removed {progress.removed} deleted {progress.removed === 1 ? "task" : "tasks"} from your Google Calendar.
            </p>
          ) : null}

          <SyncResultList title="Errors" items={progress.failed} tone="error" defaultOpen />
          {progress.failed.length > 0 && !running ? (
            <span className="-mt-2 text-xs text-muted-foreground">Run Sync again to retry these.</span>
          ) : null}
          <SyncResultList title="Skipped" items={progress.skipped} tone="muted" />
        </div>

        <DialogFooter>
          {running ? (
            <Button type="button" variant="outline" onClick={onStop} disabled={stopping}>
              {stopping ? "Stopping after this batch…" : "Stop sync"}
            </Button>
          ) : (
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
