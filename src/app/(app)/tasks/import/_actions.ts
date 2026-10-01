"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { insertTask, insertTaskBatch } from "@/app/(app)/tasks/_insert-task";
import { analyseTaskImport, type AnalysedImportRow } from "@/app/(app)/tasks/import/analyse-import";
import type { TaskImportRow } from "@/app/(app)/tasks/import/task-import-columns";
import type { AuditActor } from "@/app/(app)/tasks/_audit";
import type { createClient } from "@/lib/supabase/server";

type ImportResponse = { ok: true; rows: TaskImportRow[] } | { ok: false; error: string };

// Rows saved per batch insert. Big enough that 1000 rows is ten round trips, small enough that
// one bad row only sends a hundred to the slower one-by-one retry.
const BATCH_SIZE = 100;
// The one-by-one retry runs a few rows at a time: each is several requests (task, participants,
// audit), and unbounded parallelism floods PostgREST.
const RETRY_CONCURRENCY = 5;

// The resolved ids stay on the server; the browser only ever sees what was typed.
function toClientRow({ row, cells, status, error, problemFields }: AnalysedImportRow): TaskImportRow {
  return { row, cells, status, error, problemFields };
}

// Step 1 of 2: what WOULD happen, with nothing written — every row marked ready, duplicate or
// invalid (with its reasons), for the person to review before committing.
export async function previewTaskImport(formData: FormData): Promise<ImportResponse> {
  const auth = await requirePermission("task.create");
  if (!auth.ok) return auth;

  const analysis = await analyseTaskImport(formData.get("file"));
  if (!analysis.ok) return analysis;
  return { ok: true, rows: analysis.rows.map(toClientRow) };
}

// Step 2 of 2: re-analyses the same file (never trusting the preview the browser holds — ids
// and permissions are re-resolved server-side) and saves every ready row. Duplicate and invalid
// rows are skipped. Rows are written in batches through insertTaskBatch; if a batch fails, its
// rows are retried one by one through insertTask, so a single bad row can't sink the other 99.
export async function importTasks(formData: FormData): Promise<ImportResponse> {
  const auth = await requirePermission("task.create");
  if (!auth.ok) return auth;

  const analysis = await analyseTaskImport(formData.get("file"));
  if (!analysis.ok) return analysis;

  const actor = { userId: auth.userId, email: auth.email };
  const ready = analysis.rows.filter((row) => row.status === "ready");
  for (let start = 0; start < ready.length; start += BATCH_SIZE) {
    await saveBatch(auth.supabase, actor, ready.slice(start, start + BATCH_SIZE));
  }

  if (ready.some((row) => row.status === "created")) revalidatePath("/tasks");
  return { ok: true, rows: analysis.rows.map(toClientRow) };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Updates each row's status in place: created, or invalid with the save error.
async function saveBatch(supabase: SupabaseClient, actor: AuditActor, rows: AnalysedImportRow[]) {
  const inputs = rows.flatMap((row) => (row.input ? [row.input] : []));
  const batch = await insertTaskBatch(supabase, actor, inputs).catch(() => ({ ok: false as const }));
  if (batch.ok) {
    for (const row of rows) row.status = "created";
    return;
  }

  for (let start = 0; start < rows.length; start += RETRY_CONCURRENCY) {
    await Promise.all(
      rows.slice(start, start + RETRY_CONCURRENCY).map(async (row) => {
        if (!row.input) return;
        const saved = await insertTask(supabase, actor, row.input).catch((error: unknown) => ({
          ok: false as const,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        row.status = saved.ok ? "created" : "invalid";
        if (!saved.ok) row.error = `Couldn't save: ${saved.error}`;
      })
    );
  }
}
