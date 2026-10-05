"use client";

import { useMemo, useState } from "react";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { useRowEditing } from "@/components/data-table/use-row-editing";
import { EmptyState } from "@/components/shared/empty-state";
import { createTaskColumns } from "@/app/(app)/tasks/columns";
import { useRowParticipants } from "@/app/(app)/tasks/use-row-participants";
import { taskRowClassName } from "@/app/(app)/tasks/task-row-class-name";
import { createReminderEmailsColumn } from "@/app/(app)/settings/notifications/scheduled-reminders-columns";
import { SCHEDULE_QUERY_STATE } from "@/app/(app)/settings/notifications/schedule-query-state";
import { reminderHourLabel } from "@/app/(app)/settings/notifications/reminder-schema";
import type { DataTableFilterOption } from "@/components/data-table/table-features";
import type { ScheduledReminderRow } from "@/data/reminders";

interface ScheduledRemindersTableProps {
  rows: ScheduledReminderRow[];
  rowCount: number;
  /** Null when this person has never saved a reminder rule. */
  notifyHour: number | null;
  timezoneLabel: string;
  seasonOptions: DataTableFilterOption[];
  brandOptions: DataTableFilterOption[];
}

// Read-only view of what Steps 1 and 2 add up to: every saved task and the date each reminder
// email goes out. Reflects SAVED settings only — both steps' Save actions revalidate this page,
// so it catches up on save, not while someone is still ticking boxes.
export const ScheduledRemindersTable = ({
  rows,
  rowCount,
  notifyHour,
  timezoneLabel,
  seasonOptions,
  brandOptions,
}: ScheduledRemindersTableProps) => {
  const queryState = useDataTableQueryState(SCHEDULE_QUERY_STATE);
  // createTaskColumns needs these to build its cells; with canManage false no row ever enters
  // edit mode, so they stay idle.
  const rowEditing = useRowEditing();
  const rowParticipants = useRowParticipants();
  const [isColumnsResized, setIsColumnsResized] = useState(false);
  const sendTimeLabel = notifyHour === null ? "" : `${reminderHourLabel(notifyHour)} ${timezoneLabel} time`;

  const sendsByTaskId = useMemo(() => new Map(rows.map((row) => [row.id, row.sends])), [rows]);

  // The Tasks grid's columns, read-only and without its Actions column (edit/delete belong on
  // Tasks), then when each reminder goes out.
  const columns = useMemo(
    () => [
      ...createTaskColumns({
        canManage: false,
        canDelete: false,
        canAssignPeople: false,
        rowEditing,
        rowParticipants,
        isSaving: false,
        onConfirmEdit: () => {},
        seasonOptions,
        brandOptions,
        keyStageOptions: [],
        isResized: isColumnsResized,
      }).filter((column) => column.id !== "actions"),
      createReminderEmailsColumn({ sendTimeLabel, sendsFor: (taskId) => sendsByTaskId.get(taskId) ?? [] }),
    ],
    // rowEditing/rowParticipants never change here (nothing starts an edit), so they're left out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendTimeLabel, sendsByTaskId, seasonOptions, brandOptions, isColumnsResized]
  );
  const isSearching = !!queryState.params.filters.task_name;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Scheduled reminders</CardTitle>
        <CardDescription>
          Your selected tasks, their due dates, and when each reminder email is sent — based on your saved settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          getRowClassName={taskRowClassName}
          queryState={queryState}
          rowCount={rowCount}
          enableColumnFilterRow={false}
          enableColumnResizing
          resizeStorageKey="scheduled-reminders-column-widths"
          onResizedChange={setIsColumnsResized}
          paginationLabel="tasks"
          emptyState={
            <EmptyState
              icon={MailCheck}
              title={isSearching ? "No tasks match your search" : "No tasks selected yet"}
              description={
                isSearching ? "Try a different task name." : "Pick tasks in Step 1 and they'll show up here with their reminder dates."
              }
            />
          }
          toolbar={{
            sortOptions: [
              { columnId: "due_date", desc: false, label: "Due Date (Earliest)" },
              { columnId: "due_date", desc: true, label: "Due Date (Latest)" },
              { columnId: "task_name", desc: false, label: "Task Name (A-Z)" },
            ],
            searchColumnId: "task_name",
            searchPlaceholder: "Search tasks...",
          }}
        />
      </CardContent>
    </Card>
  );
};
