import { NextResponse, type NextRequest } from "next/server";
import { getDashboardMetrics } from "@/data/dashboard";
import { listTasksForExport } from "@/data/tasks";
import { requirePermission } from "@/lib/require-permission";
import { buildCsv } from "@/lib/export/csv";
import { buildWorkbook } from "@/lib/export/xlsx";
import { buildExportFilename } from "@/lib/export/filename";
import { defaultColumnKeys, selectColumns, type ExportSheet } from "@/lib/export/types";
import { BREAKDOWN_COLUMNS, TREND_COLUMNS, buildBreakdownRows, buildTrendRows } from "@/app/(app)/dashboard/export/summary-rows";
import { TASK_RECORD_COLUMN_GROUPS } from "@/app/(app)/tasks/export/task-record-columns";

type ExportFormat = "xlsx" | "csv";
type ExportSection = "summary" | "trend" | "records";

const VALID_FORMATS: readonly ExportFormat[] = ["xlsx", "csv"];
const VALID_SECTIONS: readonly ExportSection[] = ["summary", "trend", "records"];

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// CSV can only ever be one table (see lib/export/csv.ts) — pick whichever single section the
// caller actually wants, preferring one that includes "records" since that's the only section
// with configurable columns and therefore the only reason to ask for more than one. The dialog
// only ever sends "records" for CSV, but a hand-built query string could send anything.
function resolveSections(format: ExportFormat, requested: ExportSection[]): ExportSection[] {
  if (format === "csv") return requested.includes("records") ? ["records"] : requested.slice(0, 1);
  return requested;
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission("dashboard.export_reports");
  if (!auth.ok) return errorResponse(auth.error === "Not authenticated" ? 401 : 403, auth.error);

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") as ExportFormat | null;
  if (!format || !VALID_FORMATS.includes(format)) {
    return errorResponse(400, `format must be one of: ${VALID_FORMATS.join(", ")}`);
  }

  const requestedSections = (searchParams.get("sections") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ExportSection => (VALID_SECTIONS as readonly string[]).includes(value));
  const sections = resolveSections(format, requestedSections);
  if (sections.length === 0) return errorResponse(400, "sections must include at least one of: summary, trend, records");

  const requestedColumns = (searchParams.get("columns") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const columnKeys = requestedColumns.length > 0 ? requestedColumns : defaultColumnKeys(TASK_RECORD_COLUMN_GROUPS);

  const needsMetrics = sections.includes("summary") || sections.includes("trend");
  const needsRecords = sections.includes("records");

  const [metrics, taskRecords] = await Promise.all([
    needsMetrics ? getDashboardMetrics() : Promise.resolve(null),
    needsRecords ? listTasksForExport({}) : Promise.resolve(null),
  ]);

  // Each pushed sheet is internally consistent (its own columns always match its own rows) but
  // that pairing varies per branch, so the shared array can only be typed at the erased
  // `ExportSheet` (== `ExportSheet<unknown>`) level both writers actually consume.
  const sheets: ExportSheet[] = [];
  if (metrics && sections.includes("summary")) {
    sheets.push({ name: "Dashboard Summary", columns: BREAKDOWN_COLUMNS, rows: buildBreakdownRows(metrics) } as ExportSheet);
  }
  if (metrics && sections.includes("trend")) {
    sheets.push({ name: "Completion Trend", columns: TREND_COLUMNS, rows: buildTrendRows(metrics) } as ExportSheet);
  }
  if (taskRecords && sections.includes("records")) {
    const recordColumns = selectColumns(TASK_RECORD_COLUMN_GROUPS, columnKeys);
    if (recordColumns.length === 0) return errorResponse(400, "columns must include at least one valid Task Records column");
    sheets.push({ name: "Task Records", columns: recordColumns, rows: taskRecords.data } as ExportSheet);
  }

  const filename = buildExportFilename("dashboard", format);
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${filename}"`,
    // The dialog reads this to tell the user their Task Records sheet is a prefix of the full
    // set, not the whole thing — see listTasksForExport's own note on why exports are capped.
    "X-Export-Truncated": String(taskRecords?.truncated ?? false),
  });

  if (format === "csv") {
    headers.set("Content-Type", "text/csv;charset=utf-8");
    // Leading BOM is what makes Excel open a UTF-8 CSV as UTF-8 rather than Latin-1 — same
    // reasoning as lib/csv.ts's own client-side downloadCsv().
    return new NextResponse(`﻿${buildCsv(sheets[0])}`, { headers });
  }

  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const buffer = await buildWorkbook(sheets);
  return new NextResponse(new Uint8Array(buffer), { headers });
}
