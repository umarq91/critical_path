"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv, downloadCsv } from "@/lib/csv";
import { HOLIDAY_CSV_HEADERS } from "@/app/(app)/holidays/schema";
import { bulkImportHolidays, type BulkImportRowResult } from "@/app/(app)/holidays/_actions";
import { HOLIDAY_IMPORT_STATUS_CONFIG } from "@/constants/holiday-import-status";

function downloadTemplate() {
  downloadCsv("holiday-import-template.csv", toCsv([...HOLIDAY_CSV_HEADERS], []));
}

export const CsvBulkImport = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again after a failed attempt
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await bulkImportHolidays(formData);
    setIsUploading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const created = result.results.filter((row) => row.status === "created").length;
    toast.success(`${created} of ${result.results.length} rows added`);
    setResults(result.results);
  }

  return (
    <>
      <Button variant="outline" onClick={downloadTemplate}>
        <Download />
        Download CSV Format
      </Button>
      <Button variant="outline" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
        <Upload />
        {isUploading ? "Uploading…" : "Upload CSV"}
      </Button>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChange} />

      <FormDialog
        title="Bulk Import Results"
        description="What happened to each row in the file you uploaded."
        open={!!results}
        onOpenChange={(open) => {
          if (!open) setResults(null);
        }}
        size="lg"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results?.map((row) => (
              <TableRow key={row.row}>
                <TableCell>{row.row}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.country}</TableCell>
                <TableCell>
                  <StatusBadge value={row.status} config={HOLIDAY_IMPORT_STATUS_CONFIG} />
                </TableCell>
                <TableCell className="text-muted-foreground">{row.error ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </FormDialog>
    </>
  );
};
