import { toExportDateOnly } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Holiday } from "@/data/holidays";

// One row per holiday, drawn from the SAME `Holiday` shape the admin board renders — no
// export-specific query shape. The columns are exactly the board's own (holidays/columns.tsx),
// nothing export-only.
export const HOLIDAY_RECORD_COLUMN_GROUPS: ExportColumnGroup<Holiday>[] = [
  {
    key: "details",
    label: "Holiday Details",
    columns: [
      { key: "holiday_date", label: "Date", category: "details", defaultSelected: true, dataType: "date", width: 14, getValue: (h) => toExportDateOnly(h.holiday_date) },
      { key: "name", label: "Event Name", category: "details", defaultSelected: true, dataType: "string", width: 32, getValue: (h) => h.name },
      { key: "description", label: "Description", category: "details", defaultSelected: true, dataType: "string", width: 40, getValue: (h) => h.description },
      { key: "country", label: "Country", category: "details", defaultSelected: true, dataType: "string", width: 14, getValue: (h) => h.country },
    ],
  },
];

// The file's column order: this page's table, left to right (holidays/columns.tsx is "use client",
// so the export route can't import it — update both together).
export const HOLIDAY_GRID_COLUMN_ORDER = ["holiday_date", "name", "description", "country"];
