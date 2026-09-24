import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { listHolidaysForExport } from "@/data/holidays";
import { requirePermission } from "@/lib/require-permission";
import { buildCsv } from "@/lib/export/csv";
import { buildWorkbook } from "@/lib/export/xlsx";
import { buildExportFilename } from "@/lib/export/filename";
import { defaultColumnKeys, selectColumns, type ExportSheet } from "@/lib/export/types";
import { HOLIDAY_RECORD_COLUMN_GROUPS } from "@/app/(app)/holidays/export/holiday-record-columns";

type ExportFormat = "xlsx" | "csv";
const VALID_FORMATS: readonly ExportFormat[] = ["xlsx", "csv"];

// JSON, not comma-joined: `country` is free text (see 0027_public_holidays.sql), so a value
// like "Korea, Republic of" must survive the trip intact.
const countriesSchema = z.array(z.string());

function parseCountries(raw: string | null): string[] | null {
  if (!raw) return [];
  try {
    const result = countriesSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function errorResponse(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// The Holidays page's export — same shape as brands/export/route.ts, except the row scope is
// explicit (a country list and an optional search term) rather than the board's raw `filters`:
// the dialog lets someone export all holidays, or a different set of countries, regardless of
// what the board is currently filtered to.
export async function GET(request: NextRequest) {
  const auth = await requirePermission("dashboard.export_reports");
  if (!auth.ok) return errorResponse(auth.error === "Not authenticated" ? 401 : 403, auth.error);

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") as ExportFormat | null;
  if (!format || !VALID_FORMATS.includes(format)) {
    return errorResponse(400, `format must be one of: ${VALID_FORMATS.join(", ")}`);
  }

  const countries = parseCountries(searchParams.get("countries"));
  if (!countries) return errorResponse(400, "countries must be a JSON array of strings");
  const search = searchParams.get("search") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? undefined;
  const sortDir = searchParams.get("sortDir") ?? undefined;

  const requestedColumns = (searchParams.get("columns") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const columnKeys = requestedColumns.length > 0 ? requestedColumns : defaultColumnKeys(HOLIDAY_RECORD_COLUMN_GROUPS);
  const columns = selectColumns(HOLIDAY_RECORD_COLUMN_GROUPS, columnKeys);
  if (columns.length === 0) return errorResponse(400, "columns must include at least one valid column");

  const holidayRecords = await listHolidaysForExport({ countries, search, sortBy, sortDir });
  const sheet = { name: "Holidays", columns, rows: holidayRecords.data } as ExportSheet;

  const isFiltered = countries.length > 0 || !!search?.trim();
  const filename = buildExportFilename("holidays", format, isFiltered ? "filtered" : undefined);
  const headers = new Headers({
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Export-Truncated": String(holidayRecords.truncated),
  });

  if (format === "csv") {
    headers.set("Content-Type", "text/csv;charset=utf-8");
    return new NextResponse(`﻿${buildCsv(sheet)}`, { headers });
  }

  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const buffer = await buildWorkbook([sheet]);
  return new NextResponse(new Uint8Array(buffer), { headers });
}
