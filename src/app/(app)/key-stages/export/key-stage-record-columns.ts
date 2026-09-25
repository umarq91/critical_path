import { toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { KeyStage } from "@/data/key-stages";

// One row per key stage, drawn from the SAME `KeyStage` shape the admin board already renders
// — deliberately not a second, export-specific query. Key Stages is the smallest lookup table
// in the app (schema.md: "deliberately minimal, no status/color/season link"), so there's only
// one column group.
export const KEY_STAGE_RECORD_COLUMN_GROUPS: ExportColumnGroup<KeyStage>[] = [
  {
    key: "details",
    label: "Key Stage Details",
    columns: [
      { key: "name", label: "Name", category: "details", defaultSelected: true, dataType: "string", width: 28, getValue: (k) => k.name },
      { key: "description", label: "Description", category: "details", defaultSelected: true, dataType: "string", width: 40, getValue: (k) => k.description },
      { key: "id", label: "Key Stage ID", category: "details", defaultSelected: false, dataType: "string", width: 38, getValue: (k) => k.id },
    ],
  },
  {
    key: "dates",
    label: "Dates",
    columns: [
      { key: "created_at", label: "Created At (UTC)", category: "dates", defaultSelected: true, dataType: "date", width: 20, getValue: (k) => toExportTimestamp(k.created_at) },
      { key: "updated_at", label: "Last Updated (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (k) => toExportTimestamp(k.updated_at) },
    ],
  },
];

// The file's column order: this page's table, left to right (key-stages/columns.tsx is "use client",
// so the export route can't import it — update both together). Export-only fields sit beside
// their table counterpart or trail after.
export const KEY_STAGE_GRID_COLUMN_ORDER = [
  "name",
  "description",
  "created_at",
  "updated_at",
  "id",
];
