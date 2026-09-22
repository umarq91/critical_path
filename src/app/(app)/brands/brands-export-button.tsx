"use client";

import { useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectAllToggle } from "@/components/shared/select-all-toggle";
import { cn } from "@/lib/utils";
import { allColumnKeys, defaultColumnKeys } from "@/lib/export/types";
import { BRAND_RECORD_COLUMN_GROUPS } from "@/app/(app)/brands/export/brand-record-columns";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { BRANDS_QUERY_STATE } from "@/app/(app)/brands/query-state";

type ExportFormat = "xlsx" | "csv";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "xlsx", label: "Excel (.xlsx)", description: "One sheet, formatted columns" },
  { value: "csv", label: "CSV (.csv)", description: "Plain text, opens anywhere" },
];

const DEFAULT_COLUMN_KEYS = defaultColumnKeys(BRAND_RECORD_COLUMN_GROUPS);
const ALL_COLUMN_KEYS = allColumnKeys(BRAND_RECORD_COLUMN_GROUPS);

function filenameFromDisposition(disposition: string | null, format: ExportFormat) {
  const match = disposition ? /filename="?([^"]+)"?/.exec(disposition) : null;
  return match?.[1] ?? `brands-export.${format}`;
}

interface BrandsExportButtonProps {
  /** The board's current row count for its active filters — export always targets that same
   *  scope, so an empty board means nothing to export. */
  rowCount: number;
}

// Exports whatever the board is currently showing — same filters and sort it's reading off the
// URL (useDataTableQueryState, same hook brands-board.tsx uses), forwarded to
// brands/export/route.ts rather than re-derived. Mirrors tasks/tasks-export-button.tsx; this
// replaced a decorative "Export as CSV / Export as PDF" dropdown that had no handlers.
export const BrandsExportButton = ({ rowCount }: BrandsExportButtonProps) => {
  const { params } = useDataTableQueryState(BRANDS_QUERY_STATE);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [columns, setColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMN_KEYS));
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key: string) => {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (columns.size === 0) {
      toast.error("Choose at least one column");
      return;
    }

    setIsExporting(true);
    try {
      const searchParams = new URLSearchParams({ format, columns: Array.from(columns).join(",") });
      if (Object.keys(params.filters).length > 0) searchParams.set("filters", JSON.stringify(params.filters));
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.sortDir) searchParams.set("sortDir", params.sortDir);

      const response = await fetch(`/brands/export?${searchParams.toString()}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition"), format);
      link.click();
      URL.revokeObjectURL(url);

      const truncated = response.headers.get("X-Export-Truncated") === "true";
      toast.success(truncated ? "Export downloaded — row limit reached, file is a partial export" : "Brands exported");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <FormDialog
      title="Export Brands"
      description="Exports the brands matching your current filters."
      trigger={
        <Button variant="outline" disabled={rowCount === 0} className="gap-1.5">
          <Download />
          Export
          <ChevronDown />
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">File type</span>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                  format === option.value ? "border-primary bg-primary-tint" : "border-border hover:bg-muted"
                )}
              >
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Columns</span>
            <SelectAllToggle
              onSelectAll={() => setColumns(new Set(ALL_COLUMN_KEYS))}
              onDeselectAll={() => setColumns(new Set())}
            />
          </div>
          {BRAND_RECORD_COLUMN_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {group.columns.map((column) => (
                  <label key={column.key} className="flex items-start gap-2">
                    <Checkbox
                      checked={columns.has(column.key)}
                      onCheckedChange={() => toggleColumn(column.key)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm text-foreground">{column.label}</span>
                      {column.description ? <span className="text-xs text-muted-foreground">{column.description}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleExport} disabled={isExporting} className="w-full">
          {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </div>
    </FormDialog>
  );
};
