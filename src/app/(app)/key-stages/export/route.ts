import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { listKeyStagesForExport } from "@/data/key-stages";
import { requirePermission } from "@/lib/require-permission";
import { buildCsv } from "@/lib/export/csv";
import { buildWorkbook } from "@/lib/export/xlsx";
import { buildExportFilename } from "@/lib/export/filename";
import { defaultColumnKeys, selectColumns, type ExportSheet } from "@/lib/export/types";
import { KEY_STAGE_GRID_COLUMN_ORDER, KEY_STAGE_RECORD_COLUMN_GROUPS } from "@/app/(app)/key-stages/export/key-stage-record-columns";

type ExportFormat = "xlsx" | "csv";
const VALID_FORMATS: readonly ExportFormat[] = ["xlsx", "csv"];

// Same {string: string} shape data-table-search-params.ts's filtersSchema validates for the
// board's own URL state — kept as a private copy rather than imported, since that module's
// other exports ("nuqs/server" parsers) have no business in a Route Handler. Mirrors
// tasks/export/route.ts.
const filtersSchema = z.record(z.string(), z.string());

function parseFilters(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const result = filtersSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// The Key Stages admin page's export — always exactly one dataset (Key Stage Records), same
// shape as tasks/export/route.ts: every query param either shapes the table's rows
// (filters/sort, the board's own current state) or its columns.
export async function GET(request: NextRequest) {
  const auth = await requirePermission("dashboard.export_reports");
  if (!auth.ok) return errorResponse(auth.error === "Not authenticated" ? 401 : 403, auth.error);

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") as ExportFormat | null;
  if (!format || !VALID_FORMATS.includes(format)) {
    return errorResponse(400, `format must be one of: ${VALID_FORMATS.join(", ")}`);
  }

  const filters = parseFilters(searchParams.get("filters"));
  const sortBy = searchParams.get("sortBy") ?? undefined;
  const sortDir = searchParams.get("sortDir") ?? undefined;

  const requestedColumns = (searchParams.get("columns") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const columnKeys = requestedColumns.length > 0 ? requestedColumns : defaultColumnKeys(KEY_STAGE_RECORD_COLUMN_GROUPS);
  const columns = selectColumns(KEY_STAGE_RECORD_COLUMN_GROUPS, columnKeys, KEY_STAGE_GRID_COLUMN_ORDER);
  if (columns.length === 0) return errorResponse(400, "columns must include at least one valid column");

  const keyStageRecords = await listKeyStagesForExport({ filters, sortBy, sortDir });
  const sheet: ExportSheet = { name: "Key Stages", columns, rows: keyStageRecords.data } as ExportSheet;

  const hasFilters = Object.keys(filters).length > 0;
  const filename = buildExportFilename("key-stages", format, hasFilters ? "filtered" : undefined);
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Export-Truncated": String(keyStageRecords.truncated),
  });

  if (format === "csv") {
    headers.set("Content-Type", "text/csv;charset=utf-8");
    return new NextResponse(`﻿${buildCsv(sheet)}`, { headers });
  }

  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const buffer = await buildWorkbook([sheet]);
  return new NextResponse(new Uint8Array(buffer), { headers });
}
