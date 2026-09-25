import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import { toExportDateOnly, toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Season } from "@/data/seasons";

// One row per season, drawn from the SAME `Season` shape the admin board already renders —
// deliberately not a second, export-specific query. Seasons is a small lookup table with few
// fields, so unlike Tasks there's only one column group.
export const SEASON_RECORD_COLUMN_GROUPS: ExportColumnGroup<Season>[] = [
  {
    key: "details",
    label: "Season Details",
    columns: [
      { key: "season_code", label: "Season Code", category: "details", defaultSelected: true, dataType: "string", width: 16, getValue: (s) => s.season_code },
      { key: "season_name", label: "Season Name", category: "details", defaultSelected: true, dataType: "string", width: 28, getValue: (s) => s.season_name },
      {
        key: "status",
        label: "Status",
        category: "details",
        defaultSelected: true,
        dataType: "string",
        width: 14,
        getValue: (s) => SEASON_STATUS_CONFIG[s.status]?.label ?? s.status,
      },
      { key: "owner", label: "Owner", category: "details", defaultSelected: true, dataType: "string", width: 24, getValue: (s) => s.owner?.full_name ?? s.owner?.email ?? null },
      { key: "color", label: "Colour", category: "details", defaultSelected: false, dataType: "string", width: 10, getValue: (s) => s.color },
      { key: "id", label: "Season ID", category: "details", defaultSelected: false, dataType: "string", width: 38, getValue: (s) => s.id },
    ],
  },
  {
    key: "dates",
    label: "Dates",
    columns: [
      { key: "start_date", label: "Start Date", category: "dates", defaultSelected: true, dataType: "date", width: 14, getValue: (s) => toExportDateOnly(s.start_date) },
      { key: "end_date", label: "End Date", category: "dates", defaultSelected: true, dataType: "date", width: 14, getValue: (s) => toExportDateOnly(s.end_date) },
      { key: "created_at", label: "Created At (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (s) => toExportTimestamp(s.created_at) },
      { key: "updated_at", label: "Last Updated (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (s) => toExportTimestamp(s.updated_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (seasons/columns.tsx is "use client",
// so the export route can't import it — update both together). Export-only fields sit beside
// their table counterpart or trail after.
// The table's "Season Name" column shows season_code, so the real
// name sits right after it.
export const SEASON_GRID_COLUMN_ORDER = [
  "season_code",
  "season_name",
  "color",
  "status",
  "start_date",
  "end_date",
  "owner",
  "created_at",
  "updated_at",
  "id",
];
