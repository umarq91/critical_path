import { toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { KeyStage } from "@/data/key-stages";

// One row per key stage, drawn from the SAME `KeyStage` shape the admin board already renders
// — deliberately not a second, export-specific query. The columns are exactly the board's own
// (key-stages/columns.tsx), nothing export-only.
export const KEY_STAGE_RECORD_COLUMN_GROUPS: ExportColumnGroup<KeyStage>[] = [
  {
    key: "details",
    label: "Key Stage Details",
    columns: [
      { key: "name", label: "Name", category: "details", defaultSelected: true, dataType: "string", width: 28, getValue: (k) => k.name },
      { key: "description", label: "Description", category: "details", defaultSelected: true, dataType: "string", width: 40, getValue: (k) => k.description },
      // Both writers print a date column day-only, so this is the Melbourne calendar day — what
      // the board's Created On shows.
      { key: "created_at", label: "Created On", category: "details", defaultSelected: true, dataType: "date", width: 14, getValue: (k) => toExportTimestamp(k.created_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (key-stages/columns.tsx is "use client",
// so the export route can't import it — update both together).
export const KEY_STAGE_GRID_COLUMN_ORDER = ["name", "description", "created_at"];
