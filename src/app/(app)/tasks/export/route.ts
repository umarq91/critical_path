import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { listTasksForExport } from "@/data/tasks";
import { requirePermission } from "@/lib/require-permission";
import { buildCsv } from "@/lib/export/csv";
import { buildWorkbook } from "@/lib/export/xlsx";
import { buildExportFilename } from "@/lib/export/filename";
import { defaultColumnKeys, selectColumns, type ExportSheet } from "@/lib/export/types";
import { TASK_GRID_COLUMN_ORDER, TASK_RECORD_COLUMN_GROUPS } from "@/app/(app)/tasks/export/task-record-columns";

type ExportFormat = "xlsx" | "csv";
const VALID_FORMATS: readonly ExportFormat[] = ["xlsx", "csv"];

// Same {string: string} shape data-table-search-params.ts's filtersSchema validates for the
// grid's own URL state — kept as a private copy rather than imported, since that module's
// other exports ("nuqs/server" parsers) have no business in a Route Handler.
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

// The Task Management page's export — unlike the Dashboard's, this is always exactly one
// dataset (Task Records), so there's no "sections" concept: every query param here either
// shapes that one table's rows (filters/sortBy/sortDir, the grid's own current state) or its
// columns. See things-to-know.md's Tasks section for why filters/search/sort are forwarded
// as-is rather than re-derived from anything server-side.
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
  const columnKeys = requestedColumns.length > 0 ? requestedColumns : defaultColumnKeys(TASK_RECORD_COLUMN_GROUPS);
  const columns = selectColumns(TASK_RECORD_COLUMN_GROUPS, columnKeys, TASK_GRID_COLUMN_ORDER);
  if (columns.length === 0) return errorResponse(400, "columns must include at least one valid column");

  const taskRecords = await listTasksForExport({ filters, sortBy, sortDir });
  const sheet: ExportSheet = { name: "Tasks", columns, rows: taskRecords.data } as ExportSheet;

  const hasFilters = Object.keys(filters).length > 0;
  const filename = buildExportFilename("tasks", format, hasFilters ? "filtered" : undefined);
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Export-Truncated": String(taskRecords.truncated),
  });

  if (format === "csv") {
    headers.set("Content-Type", "text/csv;charset=utf-8");
    return new NextResponse(`﻿${buildCsv(sheet)}`, { headers });
  }

  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const buffer = await buildWorkbook([sheet]);
  return new NextResponse(new Uint8Array(buffer), { headers });
}
