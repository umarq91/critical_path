import { BRAND_STATUS_CONFIG } from "@/constants/brand-status";
import { toExportTimestamp } from "@/lib/export/dates";
import type { ExportColumnGroup } from "@/lib/export/types";
import type { Brand } from "@/data/brands";

function seasonNames(seasons: Brand["seasons"]) {
  return seasons.length > 0 ? seasons.map((season) => season.season_name).join(", ") : null;
}

// One row per brand, drawn from the SAME `Brand` shape the admin board already renders —
// deliberately not a second, export-specific query. Brands is a small lookup table with few
// fields, so unlike Tasks there's only one column group.
export const BRAND_RECORD_COLUMN_GROUPS: ExportColumnGroup<Brand>[] = [
  {
    key: "details",
    label: "Brand Details",
    columns: [
      { key: "brand_code", label: "Brand Code", category: "details", defaultSelected: true, dataType: "string", width: 16, getValue: (b) => b.brand_code },
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
      { key: "seasons", label: "Seasons", category: "details", defaultSelected: true, dataType: "string", width: 32, getValue: (b) => seasonNames(b.seasons) },
      { key: "description", label: "Description", category: "details", defaultSelected: false, dataType: "string", width: 36, getValue: (b) => b.description },
      { key: "color", label: "Colour", category: "details", defaultSelected: false, dataType: "string", width: 10, getValue: (b) => b.color },
      { key: "id", label: "Brand ID", category: "details", defaultSelected: false, dataType: "string", width: 38, getValue: (b) => b.id },
    ],
  },
  {
    key: "dates",
    label: "Dates",
    columns: [
      { key: "created_at", label: "Created At (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (b) => toExportTimestamp(b.created_at) },
      { key: "updated_at", label: "Last Updated (UTC)", category: "dates", defaultSelected: false, dataType: "date", width: 20, getValue: (b) => toExportTimestamp(b.updated_at) },
    ],
  },
];
