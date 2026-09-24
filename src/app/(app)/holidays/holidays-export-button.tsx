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
import { KNOWN_HOLIDAY_COUNTRIES } from "@/constants/holiday-country";
import { HOLIDAY_RECORD_COLUMN_GROUPS } from "@/app/(app)/holidays/export/holiday-record-columns";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { HOLIDAYS_QUERY_STATE } from "@/app/(app)/holidays/query-state";

type ExportFormat = "xlsx" | "csv";
type ExportScope = "filtered" | "all";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "xlsx", label: "Excel (.xlsx)", description: "One sheet, formatted columns" },
  { value: "csv", label: "CSV (.csv)", description: "Plain text, opens anywhere" },
];

const DEFAULT_COLUMN_KEYS = defaultColumnKeys(HOLIDAY_RECORD_COLUMN_GROUPS);
const ALL_COLUMN_KEYS = allColumnKeys(HOLIDAY_RECORD_COLUMN_GROUPS);

function filenameFromDisposition(disposition: string | null, format: ExportFormat) {
  const match = disposition ? /filename="?([^"]+)"?/.exec(disposition) : null;
  return match?.[1] ?? `holidays-export.${format}`;
}

function countryLabel(country: string) {
  const known = KNOWN_HOLIDAY_COUNTRIES.find((entry) => entry.code === country);
  return known ? `${known.label} (${known.code})` : country;
}

function optionClassName(selected: boolean) {
  return cn(
    "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
    selected ? "border-primary bg-primary-tint" : "border-border hover:bg-muted"
  );
}

interface HolidaysExportButtonProps {
  /** Rows matching the board's current filters — the "Current filters" option's count. */
  rowCount: number;
  /** Every country with at least one holiday (listDistinctHolidayCountries). */
  countries: string[];
}

// Brands' export dialog plus two things that page doesn't need: a scope choice (the board's
// current filters, or every holiday) and a country checklist. Scope is a preset for the
// checklist — "Current filters" ticks just the filtered country and keeps the search term, "All
// holidays" ticks every country and drops it — and the checklist is what's actually sent.
export const HolidaysExportButton = ({ rowCount, countries }: HolidaysExportButtonProps) => {
  const { params } = useDataTableQueryState(HOLIDAYS_QUERY_STATE);
  const filteredCountry = params.filters.country;
  const searchTerm = params.filters.name?.trim() ?? "";
  const hasFilters = !!filteredCountry || !!searchTerm;

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [scope, setScope] = useState<ExportScope>("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set(countries));
  const [columns, setColumns] = useState<Set<string>>(new Set(DEFAULT_COLUMN_KEYS));
  const [isExporting, setIsExporting] = useState(false);

  const applyScope = (next: ExportScope) => {
    setScope(next);
    setSelectedCountries(new Set(next === "filtered" && filteredCountry ? [filteredCountry] : countries));
  };

  // Re-derived on every open, not at mount: the board's filters may have changed since.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) applyScope(hasFilters ? "filtered" : "all");
    setOpen(nextOpen);
  };

  const toggle = (setter: typeof setColumns, key: string) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedCountries.size === 0) {
      toast.error("Choose at least one country");
      return;
    }
    if (columns.size === 0) {
      toast.error("Choose at least one column");
      return;
    }

    setIsExporting(true);
    try {
      const searchParams = new URLSearchParams({ format, columns: Array.from(columns).join(",") });
      // Every country ticked is sent as "no country filter", so a holiday in a country added
      // since the dialog loaded isn't silently left out.
      if (selectedCountries.size < countries.length) {
        searchParams.set("countries", JSON.stringify(Array.from(selectedCountries)));
      }
      if (scope === "filtered" && searchTerm) searchParams.set("search", searchTerm);
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.sortDir) searchParams.set("sortDir", params.sortDir);

      const response = await fetch(`/holidays/export?${searchParams.toString()}`);
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
      toast.success(truncated ? "Export downloaded — row limit reached, file is a partial export" : "Holidays exported");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <FormDialog
      title="Export Holidays"
      description="Export every holiday, or just the ones matching your current filters."
      trigger={
        <Button variant="outline" disabled={countries.length === 0} className="gap-1.5">
          <Download />
          Export
          <ChevronDown />
        </Button>
      }
      open={open}
      onOpenChange={handleOpenChange}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">File type</span>
          <div className="grid grid-cols-2 gap-2">
            {FORMAT_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => setFormat(option.value)} className={optionClassName(format === option.value)}>
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {hasFilters ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Holidays</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => applyScope("filtered")} className={optionClassName(scope === "filtered")}>
                <span className="text-sm font-medium text-foreground">Current filters ({rowCount})</span>
                <span className="text-xs text-muted-foreground">
                  {[filteredCountry && countryLabel(filteredCountry), searchTerm && `matching "${searchTerm}"`].filter(Boolean).join(", ")}
                </span>
              </button>
              <button type="button" onClick={() => applyScope("all")} className={optionClassName(scope === "all")}>
                <span className="text-sm font-medium text-foreground">All holidays</span>
                <span className="text-xs text-muted-foreground">Ignores the board&apos;s filters</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Countries</span>
            <SelectAllToggle
              onSelectAll={() => setSelectedCountries(new Set(countries))}
              onDeselectAll={() => setSelectedCountries(new Set())}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {countries.map((country) => (
              <label key={country} className="flex items-center gap-2">
                <Checkbox checked={selectedCountries.has(country)} onCheckedChange={() => toggle(setSelectedCountries, country)} />
                <span className="text-sm text-foreground">{countryLabel(country)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Columns</span>
            <SelectAllToggle onSelectAll={() => setColumns(new Set(ALL_COLUMN_KEYS))} onDeselectAll={() => setColumns(new Set())} />
          </div>
          {HOLIDAY_RECORD_COLUMN_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {group.columns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2">
                    <Checkbox checked={columns.has(column.key)} onCheckedChange={() => toggle(setColumns, column.key)} />
                    <span className="text-sm text-foreground">{column.label}</span>
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
