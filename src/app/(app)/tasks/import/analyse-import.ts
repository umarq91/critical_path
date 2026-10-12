import "server-only";
import { parseTaskImportFile } from "@/app/(app)/tasks/import/parse-import-file";
import { buildTaskImportIndexes, resolveImportRow } from "@/app/(app)/tasks/import/resolve-import-row";
import { MAX_TASK_IMPORT_ROWS, type TaskImportRow } from "@/app/(app)/tasks/import/task-import-columns";
import { loadTaskImportLookups } from "@/data/task-import-lookups";
import { listTaskIdentities } from "@/data/tasks";
import type { TaskCreateInput } from "@/app/(app)/tasks/schema";
import { TASK_FIELD_VISIBILITY } from "@/constants/task-field-visibility";

export type AnalysedImportRow = TaskImportRow & { input?: TaskCreateInput };

// While brand is hidden (TASK_FIELD_VISIBILITY) a sheet's Brand column is ignored, so every
// imported row has no brand; matching on it would let a re-uploaded export through as copies of
// every branded task. Name + season alone decide it until brand is back.
function identityKey(taskName: string, seasonId: string, brandId: string | null | undefined) {
  const brandPart = TASK_FIELD_VISIBILITY.brand ? (brandId ?? "") : "";
  return `${taskName.trim()}|${seasonId}|${brandPart}`;
}

// The whole check an uploaded sheet goes through, without writing anything: parse, resolve every
// name to an id, validate against taskCreateSchema, then mark duplicates. A row is a duplicate
// when it has the same name + season + brand as a live task, or as an earlier row in the same
// file, so re-uploading a sheet never creates copies. Run by the preview AND again by the import
// itself, which never trusts a preview the browser hands back.
export async function analyseTaskImport(
  file: unknown
): Promise<{ ok: true; rows: AnalysedImportRow[] } | { ok: false; error: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file uploaded" };

  const parsed = await parseTaskImportFile(file);
  if (!parsed.ok) return parsed;
  if (parsed.rows.length === 0) return { ok: false, error: "The file has no data rows" };
  if (parsed.rows.length > MAX_TASK_IMPORT_ROWS) {
    return { ok: false, error: `A file can have at most ${MAX_TASK_IMPORT_ROWS} rows — this one has ${parsed.rows.length}` };
  }

  const indexes = buildTaskImportIndexes(await loadTaskImportLookups());
  const resolved = parsed.rows.map((row) => ({ row, result: resolveImportRow(row, indexes) }));

  const seasonIds = [...new Set(resolved.flatMap(({ result }) => (result.ok ? [result.input.season_id] : [])))];
  const existing = new Set(
    (await listTaskIdentities(seasonIds)).map((task) => identityKey(task.task_name, task.season_id, task.brand_id))
  );
  const seenInFile = new Set<string>();

  const rows = resolved.map(({ row, result }): AnalysedImportRow => {
    const base = { row: row.rowNumber, cells: row.values };
    if (!result.ok) return { ...base, status: "invalid", error: result.error, problemFields: result.fields };

    const key = identityKey(result.input.task_name, result.input.season_id, result.input.brand_id);
    if (existing.has(key)) {
      const error = TASK_FIELD_VISIBILITY.brand
        ? "A task with this name, season and brand already exists"
        : "A task with this name and season already exists";
      return { ...base, status: "duplicate", error };
    }
    if (seenInFile.has(key)) return { ...base, status: "duplicate", error: "Repeats an earlier row in this file" };
    seenInFile.add(key);
    return { ...base, status: "ready", input: result.input };
  });

  return { ok: true, rows };
}
