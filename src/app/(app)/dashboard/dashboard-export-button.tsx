"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectAllToggle } from "@/components/shared/select-all-toggle";
import { cn } from "@/lib/utils";
import { allColumnKeys, defaultColumnKeys } from "@/lib/export/types";
import { TASK_RECORD_COLUMN_GROUPS } from "@/app/(app)/tasks/export/task-record-columns";
import type { DashboardMetrics } from "@/data/dashboard";

type ExportFormat = "xlsx" | "csv";
type ExportSection = "summary" | "trend" | "records";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "xlsx", label: "Excel (.xlsx)", description: "Multiple tabs — pick any combination below" },
  { value: "csv", label: "CSV (.csv)", description: "A single flat table — Task Records only" },
];

const SECTION_OPTIONS: { id: ExportSection; label: string; description: string }[] = [
  { id: "summary", label: "Dashboard Summary", description: "Status, Season, Brand and Gender breakdowns" },
  { id: "trend", label: "Completion Trend", description: "Monthly and weekly completed-vs-overdue figures" },
  { id: "records", label: "Task Records", description: "One row per task, with the columns you choose below" },
];

const DEFAULT_COLUMN_KEYS = defaultColumnKeys(TASK_RECORD_COLUMN_GROUPS);
const ALL_COLUMN_KEYS = allColumnKeys(TASK_RECORD_COLUMN_GROUPS);

function filenameFromDisposition(disposition: string | null, format: ExportFormat) {
  const match = disposition ? /filename="?([^"]+)"?/.exec(disposition) : null;
  return match?.[1] ?? `dashboard-export.${format}`;
}

// Exports go through the Route Handler at ./export/route.ts, not a Server Action — a Server
// Action can't return a binary XLSX response. What's included is fully user-configurable
// (format, which dashboard sections, which Task Record columns) rather than the old fixed
// client-side CSV dump, so this now round-trips to the server for every export.
export const DashboardExportButton = ({ metrics }: { metrics: DashboardMetrics }) => {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [sections, setSections] = useState<Set<ExportSection>>(new Set<ExportSection>(["summary", "trend", "records"]));
  const [columns, setColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMN_KEYS));
  const [isExporting, setIsExporting] = useState(false);

  // CSV can only hold one table (see lib/export/csv.ts's own note) — Task Records is the one
  // with configurable columns, so that's what CSV always exports; the section checklist only
  // makes sense once XLSX's multi-tab workbook is in play.
  const activeSections = format === "csv" ? new Set<ExportSection>(["records"]) : sections;
  const showRecordColumns = activeSections.has("records");

  const toggleSection = (id: ExportSection) => {
    setSections((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key: string) => {
    setColumns((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (activeSections.size === 0) {
      toast.error("Choose at least one section to export");
      return;
    }
    if (showRecordColumns && columns.size === 0) {
      toast.error("Choose at least one Task Records column");
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format, sections: Array.from(activeSections).join(",") });
      if (showRecordColumns) params.set("columns", Array.from(columns).join(","));

      const response = await fetch(`/dashboard/export?${params.toString()}`);
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
      toast.success(truncated ? "Export downloaded — row limit reached, file is a partial export" : "Dashboard export downloaded");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <FormDialog
      title="Export Dashboard"
      description="Choose a file type and what to include."
      trigger={
        <Button disabled={metrics.total === 0}>
          <Download />
          Export
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

        {format === "xlsx" ? (
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Include</span>
            {SECTION_OPTIONS.map((section) => (
              <label key={section.id} className="flex items-start gap-3">
                <Checkbox
                  checked={activeSections.has(section.id)}
                  onCheckedChange={() => toggleSection(section.id)}
                  className="mt-0.5"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{section.label}</span>
                  <span className="text-sm text-muted-foreground">{section.description}</span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {showRecordColumns ? (
          <div className="flex flex-col gap-4">
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Task Records columns</span>
              <SelectAllToggle
                onSelectAll={() => setColumns(new Set(ALL_COLUMN_KEYS))}
                onDeselectAll={() => setColumns(new Set())}
              />
            </div>
            {TASK_RECORD_COLUMN_GROUPS.map((group) => (
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
        ) : null}

        <Button onClick={handleExport} disabled={isExporting} className="w-full">
          {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </div>
    </FormDialog>
  );
};
