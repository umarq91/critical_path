"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { REMINDER_SEND_STATUS_CONFIG } from "@/constants/reminder-send-status";
import { formatDate } from "@/lib/dates";
import type { ScheduledReminderSend } from "@/data/reminders";
import type { Task } from "@/data/tasks";

const columnHelper = createColumnHelper<typeof dataTableFeatures, Task>();

function offsetLabel(offsetDays: number) {
  if (offsetDays === 0) return "on the due date";
  return offsetDays === 1 ? "1 day before" : `${offsetDays} days before`;
}

function EmptySends({ task }: { task: Task }) {
  const message = task.due_date ? "No timing set — choose when in Step 2" : "No due date, so no reminders";
  return <span className="text-sm text-muted-foreground">{message}</span>;
}

// Only the column this table adds. Everything before it is the Tasks grid's own column set
// (createTaskColumns), composed in scheduled-reminders-table.tsx, so the two can't drift apart.
// Typed on Task, not ScheduledReminderRow, so it can share one array with those columns (a
// column def's row type is invariant); the sends are looked up by task id instead.
export function createReminderEmailsColumn({
  sendTimeLabel,
  sendsFor,
}: {
  sendTimeLabel: string;
  sendsFor: (taskId: string) => ScheduledReminderSend[];
}) {
  return columnHelper.display({
    id: "sends",
    header: "Reminder Emails",
    meta: { label: "Reminder Emails", width: "lg" },
    size: 320,
    minSize: 200,
    cell: ({ row }) => {
      const sends = sendsFor(row.original.id);
      if (sends.length === 0) return <EmptySends task={row.original} />;
      return (
        <ul className="flex flex-col gap-1.5">
          {sends.map((send) => (
            <li key={send.offsetDays} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-foreground">
                {formatDate(send.sendDate)}, {sendTimeLabel}
              </span>
              <span className="text-xs text-muted-foreground">({offsetLabel(send.offsetDays)})</span>
              <StatusBadge value={send.status} config={REMINDER_SEND_STATUS_CONFIG} />
            </li>
          ))}
        </ul>
      );
    },
  });
}
