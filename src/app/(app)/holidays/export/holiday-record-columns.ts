import { toExportDateOnly, toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Holiday } from "@/data/holidays";

// One row per holiday, drawn from the SAME `Holiday` shape the admin board renders — no
// export-specific query shape. Same two-group layout as the other lookup exports.
export const HOLIDAY_RECORD_COLUMN_GROUPS: ExportColumnGroup<Holiday>[] = [
  {
    key: "details",
    label: "Holiday Details",
    columns: [
      { key: "holiday_date", label: "Date", category: "details", defaultSelected: true, dataType: "date", width: 14, getValue: (h) => toExportDateOnly(h.holiday_date) },
      { key: "name", label: "Event Name", category: "details", defaultSelected: true, dataType: "string", width: 32, getValue: (h) => h.name },
      { key: "country", label: "Country", category: "details", defaultSelected: true, dataType: "string", width: 14, getValue: (h) => h.country },
      { key: "description", label: "Description", category: "details", defaultSelected: false, dataType: "string", width: 40, getValue: (h) => h.description },
      { key: "id", label: "Holiday ID", category: "details", defaultSelected: false, dataType: "string", width: 38, getValue: (h) => h.id },
    ],
  },
  {
    key: "dates",
    label: "Record Dates",
    columns: [
      { key: "created_at", label: "Created At (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (h) => toExportTimestamp(h.created_at) },
      { key: "updated_at", label: "Last Updated (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (h) => toExportTimestamp(h.updated_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (holidays/columns.tsx is "use client",
// so the export route can't import it — update both together). Export-only fields sit beside
// their table counterpart or trail after.
export const HOLIDAY_GRID_COLUMN_ORDER = [
  "holiday_date",
  "name",
  "description",
  "country",
  "created_at",
  "updated_at",
  "id",
];
