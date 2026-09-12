import "server-only";
import ExcelJS from "exceljs";
import type { ExportColumn, ExportSheet } from "@/lib/export/types";

// exceljs's own numFmt strings — kept in one place so every date/percent cell in the workbook
// is formatted identically rather than each sheet builder inventing its own.
const DATE_FORMAT = "yyyy-mm-dd";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true };

// A blank cell is `null` in every format, never the empty string or the string "null" — an
// empty string still sorts/filters as a value in Excel, and "null" reads as data.
function cellValue(column: ExportColumn<unknown>, row: unknown): ExcelJS.CellValue {
  const value = column.getValue(row);
  return value === undefined ? null : value;
}

function writeSheet(workbook: ExcelJS.Workbook, sheet: ExportSheet) {
  const worksheet = workbook.addWorksheet(sheet.name, {
    // Freezes the header row only — the sheet can still have thousands of data rows below it,
    // and this is what keeps the column labels on screen while scrolling through them.
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = sheet.columns.map((column) => ({
    header: column.label,
    key: column.key,
    // A fixed per-column hint (see ExportColumn.width's own note) rather than autofit, which
    // exceljs doesn't support natively.
    width: column.width ?? 18,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });

  for (const row of sheet.rows) {
    const values: Record<string, ExcelJS.CellValue> = {};
    for (const column of sheet.columns) values[column.key] = cellValue(column, row);
    const excelRow = worksheet.addRow(values);

    // Column-level dataType only says "this is a date"; the numFmt has to be applied per cell
    // (not per column) because exceljs derives a cell's own type from the value it was given,
    // and a `null` date cell would otherwise still need the format to read as an empty date
    // rather than an empty string once a real value appears elsewhere in the column.
    sheet.columns.forEach((column, index) => {
      if (column.dataType === "date") excelRow.getCell(index + 1).numFmt = DATE_FORMAT;
    });
  }
}

/** Builds a complete workbook from one or more logically distinct tables — a summary sheet and
 *  a detail-records sheet, in the dashboard export's case. Each `ExportSheet` is independent:
 *  its own columns, its own rows, its own tab. */
export async function buildWorkbook(sheets: ExportSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  for (const sheet of sheets) writeSheet(workbook, sheet);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
