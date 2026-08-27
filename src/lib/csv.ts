export type CsvRow = (string | number)[];

// RFC 4180 quoting: wrap whenever the value could otherwise break the row, and double any
// embedded quote. A leading BOM is what makes Excel open UTF-8 as UTF-8 rather than Latin-1.
const BOM = "﻿";

function escapeCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: CsvRow, rows: CsvRow[]) {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([BOM, content], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
