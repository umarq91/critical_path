"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { brandSchema, brandUpdateSchema } from "@/app/(app)/brands/schema";

export async function createBrand(input: unknown) {
  const auth = await requirePermission("brand.manage");
  if (!auth.ok) return auth;

  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await auth.supabase.from("brands").insert(parsed.data).select().single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/brands");
  return { ok: true as const, data };
}

export async function updateBrand(id: string, patch: unknown) {
  const auth = await requirePermission("brand.manage");
  if (!auth.ok) return auth;

  const parsed = brandUpdateSchema.safeParse(patch);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase.from("brands").update(parsed.data).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/brands");
  return { ok: true as const };
}

export async function deleteBrand(id: string) {
  const auth = await requirePermission("brand.delete");
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("brands").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/brands");
  return { ok: true as const };
}
