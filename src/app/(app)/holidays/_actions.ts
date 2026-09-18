"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { requirePermission } from "@/lib/require-permission";
import { holidaySchema, MAX_BULK_HOLIDAY_ROWS } from "@/app/(app)/holidays/schema";
import { listHolidays, type ListHolidaysParams } from "@/data/holidays";

// Powers the isolated "Refresh" icon on the holidays table (see useRefreshableData) — a plain
// read, not a mutation, same reasoning as every other lookup's refresh action.
export async function refreshHolidays(params: ListHolidaysParams) {
  return listHolidays(params);
}

export async function createHoliday(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("public_holidays").insert(parsed.data);
  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "A holiday with that name already exists on that date for that country" : error.message,
    };
  }

  revalidatePath("/holidays");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function updateHoliday(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = holidaySchema.partial().safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("public_holidays").update(parsed.data).eq("id", id);
  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? "A holiday with that name already exists on that date for that country" : error.message,
    };
  }

  revalidatePath("/holidays");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function deleteHoliday(id: string) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("public_holidays").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/holidays");
  revalidatePath("/calendar");
  return { ok: true as const };
}

export interface BulkImportRowResult {
  row: number;
  date: string;
  name: string;
  country: string;
  status: "created" | "duplicate" | "invalid";
  error?: string;
}

// Matches a parsed CSV header against HOLIDAY_CSV_HEADERS regardless of case or spacing, so
// "Event Name", "event_name" and "EVENT NAME" all resolve the same column.
function normaliseHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const FIELD_BY_HEADER: Record<string, "holiday_date" | "name" | "description" | "country"> = {
  date: "holiday_date",
  eventname: "name",
  description: "description",
  country: "country",
};

// Reads an uploaded CSV, validates and writes each row independently against the same
// holidaySchema the single add form uses, and reports every row's outcome — a bad row never
// blocks the good ones in the same file (see the spec's Key invariants).
export async function bulkImportHolidays(formData: FormData): Promise<
  { ok: true; results: BulkImportRowResult[] } | { ok: false; error: string }
> {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "No file uploaded" };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => FIELD_BY_HEADER[normaliseHeader(header)] ?? header,
  });

  if (parsed.data.length === 0) {
    return { ok: false as const, error: "The file has no data rows" };
  }
  if (parsed.data.length > MAX_BULK_HOLIDAY_ROWS) {
    return { ok: false as const, error: `A file can have at most ${MAX_BULK_HOLIDAY_ROWS} rows` };
  }

  const results: BulkImportRowResult[] = [];
  // Tracks what's already been accepted in this same file, so two identical rows in one upload
  // catch each other as duplicates too, not only a row that matches something already in the
  // database.
  const acceptedThisBatch = new Set<string>();

  for (const [index, rawRow] of parsed.data.entries()) {
    const rowNumber = index + 2; // +1 for the header row, +1 for 1-based counting
    const candidate = {
      country: rawRow.country ?? "",
      holiday_date: rawRow.holiday_date ?? "",
      name: rawRow.name ?? "",
      description: rawRow.description || undefined,
    };

    const rowParsed = holidaySchema.safeParse(candidate);
    if (!rowParsed.success) {
      results.push({
        row: rowNumber,
        date: candidate.holiday_date,
        name: candidate.name,
        country: candidate.country,
        status: "invalid",
        error: rowParsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }

    const dedupeKey = `${rowParsed.data.country}|${rowParsed.data.holiday_date}|${rowParsed.data.name}`;
    if (acceptedThisBatch.has(dedupeKey)) {
      results.push({
        row: rowNumber,
        date: rowParsed.data.holiday_date,
        name: rowParsed.data.name,
        country: rowParsed.data.country,
        status: "duplicate",
        error: "Repeats an earlier row in this same file",
      });
      continue;
    }

    const { error } = await auth.supabase.from("public_holidays").insert(rowParsed.data);
    if (error) {
      const isDuplicate = error.code === "23505";
      results.push({
        row: rowNumber,
        date: rowParsed.data.holiday_date,
        name: rowParsed.data.name,
        country: rowParsed.data.country,
        status: isDuplicate ? "duplicate" : "invalid",
        error: isDuplicate ? "Already exists" : error.message,
      });
      continue;
    }

    acceptedThisBatch.add(dedupeKey);
    results.push({
      row: rowNumber,
      date: rowParsed.data.holiday_date,
      name: rowParsed.data.name,
      country: rowParsed.data.country,
      status: "created",
    });
  }

  revalidatePath("/holidays");
  revalidatePath("/calendar");
  return { ok: true as const, results };
}
