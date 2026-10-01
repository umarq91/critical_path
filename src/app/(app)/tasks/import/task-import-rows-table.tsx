"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BULK_IMPORT_STATUS_CONFIG } from "@/constants/bulk-import-status";
import { cn } from "@/lib/utils";
import { importFieldLabel, type TaskImportField, type TaskImportRow } from "@/app/(app)/tasks/import/task-import-columns";

const CELL_FIELDS: TaskImportField[] = [
  "task_name",
  "season",
  "brand",
  "key_stage",
  "owners",
  "people_involved",
  "gender",
  "dpsp_category",
  "due_date",
];

type Filter = "all" | TaskImportRow["status"];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TaskImportRowsTableProps {
  rows: TaskImportRow[];
  /** Which statuses get their own filter button — the preview's "ready" becomes "created" once imported. */
  statuses: TaskImportRow["status"][];
}

// The preview's (and the results') row list. Rows live in memory — they came from one uploaded
// file, not the database — so filtering and paging are local; there is no query to push them to.
export const TaskImportRowsTable = ({ rows, statuses }: TaskImportRowsTableProps) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);
  const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: rows.length },
    ...statuses.map((status) => ({
      value: status,
      label: BULK_IMPORT_STATUS_CONFIG[status]?.label ?? status,
      count: rows.filter((row) => row.status === status).length,
    })),
  ];

  function selectFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? "default" : "outline"}
            onClick={() => selectFilter(option.value)}
          >
            {option.label} ({option.count})
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Row</TableHead>
              <TableHead>Status</TableHead>
              {CELL_FIELDS.map((field) => (
                <TableHead key={field}>{importFieldLabel(field)}</TableHead>
              ))}
              <TableHead className="min-w-64">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={CELL_FIELDS.length + 3} className="py-8 text-center text-muted-foreground">
                  No rows in this view
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.row} className="align-top">
                  <TableCell className="text-muted-foreground">{row.row}</TableCell>
                  <TableCell>
                    <StatusBadge value={row.status} config={BULK_IMPORT_STATUS_CONFIG} />
                  </TableCell>
                  {CELL_FIELDS.map((field) => {
                    const value = row.cells[field] ?? "";
                    const hasProblem = row.problemFields?.includes(field) ?? false;
                    return (
                      <TableCell
                        key={field}
                        className={cn(
                          "max-w-48 whitespace-normal",
                          hasProblem && "bg-status-overdue-soft font-medium text-status-overdue-text"
                        )}
                      >
                        {value || (hasProblem ? "Missing" : "—")}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={cn(
                      "whitespace-normal",
                      row.status === "invalid" ? "text-status-overdue-text" : "text-muted-foreground"
                    )}
                  >
                    {row.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={page}
        pageSize={pageSize}
        rowCount={visible.length}
        totalLabel="rows"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  );
};
