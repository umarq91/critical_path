import type { ExportColumnGroup } from "@/lib/export/types";
import type { Season } from "@/data/seasons";

// One row per season, drawn from the SAME `Season` shape the admin board already renders —
// deliberately not a second, export-specific query. The columns are the board's own
// (seasons/columns.tsx), nothing export-only. Tasks and Completion % aren't here: they come from
// a separate per-season stats query, not the `Season` row.
export const SEASON_RECORD_COLUMN_GROUPS: ExportColumnGroup<Season>[] = [
  {
    key: "details",
    label: "Season Details",
    columns: [
      { key: "season", label: "Season", category: "details", defaultSelected: true, dataType: "string", width: 16, getValue: (s) => s.season },
      { key: "color", label: "Colour", category: "details", defaultSelected: true, dataType: "string", width: 10, getValue: (s) => s.color },
    ],
  },
];

// The file's column order: this page's table, left to right (seasons/columns.tsx is "use client",
// so the export route can't import it — update both together).
export const SEASON_GRID_COLUMN_ORDER = ["season", "color"];
