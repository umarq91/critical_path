"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { REMINDER_SEND_STATUS_CONFIG } from "@/constants/reminder-send-status";
import { formatDate } from "@/lib/dates";
import type { ScheduledReminderRow } from "@/data/reminders";

const columnHelper = createColumnHelper<typeof dataTableFeatures, ScheduledReminderRow>();

function offsetLabel(offsetDays: number) {
  if (offsetDays === 0) return "on the due date";
  return offsetDays === 1 ? "1 day before" : `${offsetDays} days before`;
}

function EmptySends({ row }: { row: ScheduledReminderRow }) {
  const message = row.due_date ? "No timing set — choose when in Step 2" : "No due date, so no reminders";
  return <span className="text-sm text-muted-foreground">{message}</span>;
}

export function createScheduledReminderColumns({ sendTimeLabel }: { sendTimeLabel: string }) {
  return [
    columnHelper.accessor("task_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
      meta: { label: "Task", width: "lg" },
      cell: ({ row, getValue }) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{getValue()}</span>
          {row.original.season_name ? (
            <span className="truncate text-xs text-muted-foreground">{row.original.season_name}</span>
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor("due_date", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
      meta: { label: "Due Date", width: "sm" },
      cell: ({ getValue }) => {
        const dueDate = getValue();
        return dueDate ? formatDate(dueDate) : <span className="text-muted-foreground">—</span>;
      },
    }),
    columnHelper.display({
      id: "sends",
      header: "Reminder Emails",
      meta: { label: "Reminder Emails", width: "lg" },
      cell: ({ row }) => {
        if (row.original.sends.length === 0) return <EmptySends row={row.original} />;
        return (
          <ul className="flex flex-col gap-1.5">
            {row.original.sends.map((send) => (
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
    }),
  ];
}
