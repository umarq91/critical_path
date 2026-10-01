"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/form-dialog";
import { toCsv, downloadCsv } from "@/lib/csv";
import { importTasks, previewTaskImport } from "@/app/(app)/tasks/import/_actions";
import { TaskImportRowsTable } from "@/app/(app)/tasks/import/task-import-rows-table";
import {
  MAX_TASK_IMPORT_FILE_BYTES,
  MAX_TASK_IMPORT_ROWS,
  TASK_IMPORT_TEMPLATE_HEADERS,
  type TaskImportRow,
} from "@/app/(app)/tasks/import/task-import-columns";

type Phase = "choose" | "checking" | "preview" | "importing" | "done";

function downloadTemplate() {
  downloadCsv("task-import-template.csv", toCsv(TASK_IMPORT_TEMPLATE_HEADERS, []));
}

function countBy(rows: TaskImportRow[], status: TaskImportRow["status"]) {
  return rows.filter((row) => row.status === status).length;
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

const UNEXPECTED_ERROR = { ok: false as const, error: "Something went wrong — please try again" };

// Two steps: uploading a file only CHECKS it (previewTaskImport writes nothing) and lists every
// row as ready, duplicate or invalid. Tasks are created only when the person confirms, and the
// server re-checks the same file then rather than trusting this preview.
export const TaskImportButton = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<TaskImportRow[]>([]);
  const isBusy = phase === "checking" || phase === "importing";
  const readyCount = countBy(rows, "ready");

  function reset() {
    setPhase("choose");
    setFile(null);
    setRows([]);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again after fixing it
    if (!picked) return;
    if (picked.size > MAX_TASK_IMPORT_FILE_BYTES) {
      toast.error("That file is too large — the limit is 1 MB");
      return;
    }

    setPhase("checking");
    const formData = new FormData();
    formData.append("file", picked);
    const result = await previewTaskImport(formData).catch(() => UNEXPECTED_ERROR);
    if (!result.ok) {
      toast.error(result.error);
      reset();
      return;
    }
    setFile(picked);
    setRows(result.rows);
    setPhase("preview");
  }

  async function handleImport() {
    if (!file) return;
    setPhase("importing");
    const formData = new FormData();
    formData.append("file", file);
    const result = await importTasks(formData).catch(() => UNEXPECTED_ERROR);
    if (!result.ok) {
      toast.error(result.error);
      setPhase("preview");
      return;
    }
    setRows(result.rows);
    setPhase("done");
    toast.success(`${plural(countBy(result.rows, "created"), "task")} added`);
  }

  const duplicateCount = countBy(rows, "duplicate");
  const invalidCount = countBy(rows, "invalid");

  return (
    <FormDialog
      title="Import Tasks"
      description={`Add up to ${MAX_TASK_IMPORT_ROWS} tasks from an Excel or CSV file. Use names exactly as they appear in the app.`}
      size={phase === "choose" || phase === "checking" ? "md" : "xl"}
      className={phase === "preview" || phase === "importing" || phase === "done" ? "sm:max-w-6xl" : undefined}
      open={open}
      onOpenChange={(next) => {
        if (isBusy) return;
        setOpen(next);
        if (!next) reset();
      }}
      trigger={
        <Button variant="outline">
          <Upload />
          Import
        </Button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={handleFileChange}
      />

      {phase === "choose" || phase === "checking" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your file is checked first. Nothing is added until you review the rows and confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate} disabled={isBusy}>
              <Download />
              Download Template
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
              {phase === "checking" ? <Loader2 className="animate-spin" /> : <Upload />}
              {phase === "checking" ? "Checking file…" : "Upload File"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {phase === "done" ? (
            <p className="text-sm text-foreground">
              <strong className="font-semibold">{plural(countBy(rows, "created"), "task")} added.</strong>{" "}
              {duplicateCount + invalidCount > 0
                ? `${plural(duplicateCount + invalidCount, "row")} not added — see Duplicate and Invalid below.`
                : null}
            </p>
          ) : (
            <p className="text-sm text-foreground">
              <strong className="font-semibold">{plural(readyCount, "task")} ready to add</strong> from{" "}
              {file?.name}.{" "}
              {duplicateCount + invalidCount > 0
                ? `${plural(duplicateCount + invalidCount, "row")} will be skipped. Fix invalid rows in your sheet and upload it again, or add the ready ones now.`
                : null}
            </p>
          )}

          <TaskImportRowsTable
            key={phase === "done" ? "done" : "preview"}
            rows={rows}
            statuses={phase === "done" ? ["created", "duplicate", "invalid"] : ["ready", "duplicate", "invalid"]}
          />

          <div className="flex flex-wrap justify-end gap-2">
            {phase === "done" ? (
              <>
                <Button variant="outline" onClick={reset}>
                  Import Another File
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
                  Choose a Different File
                </Button>
                <Button onClick={handleImport} disabled={isBusy || readyCount === 0}>
                  {phase === "importing" ? <Loader2 className="animate-spin" /> : <Upload />}
                  {phase === "importing" ? "Adding tasks…" : `Add ${plural(readyCount, "Task")}`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </FormDialog>
  );
};
