import { BRAND_STATUS_CONFIG } from "@/constants/brand-status";
import { toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Brand } from "@/data/brands";

// One row per brand, drawn from the SAME `Brand` shape the admin board already renders —
// deliberately not a second, export-specific query. The columns are exactly the board's own
// (brands/columns.tsx), nothing export-only: Description, Colour and the raw id aren't on the
// table, so they aren't in the file. The Tasks column is left out because it has no data yet.
export const BRAND_RECORD_COLUMN_GROUPS: ExportColumnGroup<Brand>[] = [
  {
    key: "details",
    label: "Brand Details",
    columns: [
      { key: "brand_name", label: "Brand Name", category: "details", defaultSelected: true, dataType: "string", width: 28, getValue: (b) => b.brand_name },
      {
        key: "status",
        label: "Status",
        category: "details",
        defaultSelected: true,
        dataType: "string",
        width: 14,
        getValue: (b) => BRAND_STATUS_CONFIG[b.status]?.label ?? b.status,
      },
      // Both writers print a date column day-only, so this is the Melbourne calendar day — what
      // the board's Created On shows.
      { key: "created_at", label: "Created On", category: "details", defaultSelected: true, dataType: "date", width: 14, getValue: (b) => toExportTimestamp(b.created_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (brands/columns.tsx is "use client",
// so the export route can't import it — update both together).
export const BRAND_GRID_COLUMN_ORDER = ["brand_name", "status", "created_at"];
