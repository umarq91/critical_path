"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { keyStageSchema, keyStageUpdateSchema } from "@/app/(app)/key-stages/schema";

export async function createKeyStage(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = keyStageSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase.from("key_stages").insert(parsed.data).select().single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/key-stages");
  return { ok: true as const, data };
}

export async function updateKeyStage(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = keyStageUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("key_stages").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/key-stages");
  return { ok: true as const };
}

export async function deleteKeyStage(id: string) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("key_stages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/key-stages");
  return { ok: true as const };
}
