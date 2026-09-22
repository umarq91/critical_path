"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { savedViewSchema } from "@/app/(app)/tasks/saved-view-schema";

// Split out from tasks/_actions.ts (task CRUD) rather than added there — a distinct entity,
// and that file is already near the file-length guideline. Gated on "task.view", not a more
// specific action: a saved view is just a personal bookmark of the Tasks grid's own filters, so
// anyone who can see the grid (every internal role, and external users for their own scoped
// view of it) can save one — same reasoning as reminder_rules being gated on "profile.update_own"
// rather than an admin-only action.

export async function createSavedView(input: unknown) {
  const auth = await requirePermission("task.view");
  if (!auth.ok) return auth;

  const parsed = savedViewSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase
    .from("saved_views")
    .insert({
      profile_id: auth.userId,
      name: parsed.data.name,
      filters: parsed.data.filters,
      sort_by: parsed.data.sortBy ?? null,
      sort_dir: parsed.data.sortDir ?? null,
    })
    .select("id, name, filters, sort_by, sort_dir")
    .single();

  if (error) {
    return {
      ok: false as const,
      error: error.code === "23505" ? `You already have a view named "${parsed.data.name}"` : error.message,
    };
  }

  revalidatePath("/tasks");
  return { ok: true as const, data };
}

export async function deleteSavedView(id: string) {
  const auth = await requirePermission("task.view");
  if (!auth.ok) return auth;

  // Scoped to the caller's own row via RLS (saved_views_own_row) — no need to re-check
  // ownership here, same as reminder_rules' own delete path never does.
  const { error } = await auth.supabase.from("saved_views").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/tasks");
  return { ok: true as const };
}
