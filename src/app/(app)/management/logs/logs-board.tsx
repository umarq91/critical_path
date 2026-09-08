"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { EmptyState } from "@/components/shared/empty-state";
import { createAuditLogColumns } from "@/app/(app)/management/logs/columns";
import { LogDetailDialog } from "@/app/(app)/management/logs/log-detail-dialog";
import { AUDIT_ACTION_CONFIG, AUDIT_PERIOD_OPTIONS } from "@/constants/audit";
import type { AuditEvent } from "@/data/audit-log";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface LogsBoardProps {
  events: AuditEvent[];
  rowCount: number;
  actorOptions: DataTableFilterOption[];
}

// Newest first, and there is no other sensible default for a log.
const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "created_at", desc: true } };

const ACTION_OPTIONS = Object.entries(AUDIT_ACTION_CONFIG).map(([value, { label }]) => ({ value, label }));

export const LogsBoard = ({ events, rowCount, actorOptions }: LogsBoardProps) => {
  const queryState = useDataTableQueryState(QUERY_STATE_OPTIONS);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const columns = useMemo(() => createAuditLogColumns(), []);

  return (
    <>
      <DataTable
        columns={columns}
        data={events}
        queryState={queryState}
        rowCount={rowCount}
        enableColumnFilterRow={false}
        paginationLabel="events"
        onRowClick={setSelected}
        emptyState={
          <EmptyState
            title="No activity yet"
            description="Task creates, edits, owner changes and deletions will appear here as they happen."
          />
        }
        toolbar={{
          filters: [
            { columnId: "action", title: "Action", placeholder: "All Actions", options: ACTION_OPTIONS },
            { columnId: "actor", title: "People", placeholder: "All People", options: actorOptions },
            // Filters on created_at, but its values are period keywords resolved to a cutoff
            // server-side (see data/audit-log.ts) — so a saved or shared URL keeps meaning
            // "the last 7 days", not the 7 days before it was saved.
            { columnId: "created_at", title: "Period", placeholder: "All Time", options: AUDIT_PERIOD_OPTIONS },
          ],
          sortOptions: [
            { columnId: "created_at", desc: true, label: "Newest First" },
            { columnId: "created_at", desc: false, label: "Oldest First" },
          ],
          searchColumnId: "entity_label",
          searchPlaceholder: "Search by task or email...",
        }}
      />
      {selected ? (
        <LogDetailDialog event={selected} open onOpenChange={(open) => !open && setSelected(null)} />
      ) : null}
    </>
  );
};
