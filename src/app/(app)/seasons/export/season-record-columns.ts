import { toExportTimestamp } from "@/lib/export/dates";
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
      { key: "season", label: "Season", category: "details", defaultSelected: true, dataType: "string", width: 16, getValue: (s) => s.season },
      { key: "color", label: "Colour", category: "details", defaultSelected: false, dataType: "string", width: 10, getValue: (s) => s.color },
      { key: "id", label: "Season ID", category: "details", defaultSelected: false, dataType: "string", width: 38, getValue: (s) => s.id },
    ],
  },
  {
    key: "dates",
    label: "Dates",
    columns: [
      { key: "created_at", label: "Created At (Melbourne time)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (s) => toExportTimestamp(s.created_at) },
      { key: "updated_at", label: "Last Updated (Melbourne time)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (s) => toExportTimestamp(s.updated_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (seasons/columns.tsx is "use client",
// so the export route can't import it — update both together). Export-only fields sit beside
// their table counterpart or trail after.
export const SEASON_GRID_COLUMN_ORDER = [
  "season",
  "color",
  "created_at",
  "updated_at",
  "id",
];
