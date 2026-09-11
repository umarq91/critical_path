"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { externalLinkSchema, externalLinkUpdateSchema } from "@/app/(app)/external-links/schema";

export async function createExternalLink(input: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = externalLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase.from("external_links").insert(parsed.data).select().single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/external-links");
  return { ok: true as const, data };
}

export async function updateExternalLink(id: string, patch: unknown) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const parsed = externalLinkUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("external_links").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/external-links");
  return { ok: true as const };
}

export async function deleteExternalLink(id: string) {
  const auth = await requirePermission("admin.manage_lookups");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("external_links")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/external-links");
  return { ok: true as const };
}
