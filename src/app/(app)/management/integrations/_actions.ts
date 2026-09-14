"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { recordAuditEvent } from "@/lib/audit";
import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@/constants/audit";
import { generateApiKey } from "@/lib/integration/keys";
import { apiKeyCreateSchema } from "@/app/(app)/management/integrations/schema";

export async function createApiKey(input: unknown) {
  const auth = await requirePermission("admin.manage_integrations");
  if (!auth.ok) return auth;

  const parsed = apiKeyCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { raw, prefix, hash } = generateApiKey();

  const { data, error } = await auth.supabase
    .from("api_keys")
    .insert({ name: parsed.data.name, key_prefix: prefix, key_hash: hash, created_by: auth.userId })
    .select("id, name")
    .single();
  if (error) return { ok: false as const, error: error.message };

  await recordAuditEvent(auth.supabase, {
    actorId: auth.userId,
    actorEmail: auth.email,
    action: AUDIT_ACTION.API_KEY_CREATE,
    entityType: AUDIT_ENTITY_TYPE.API_KEY,
    entityId: data.id,
    entityLabel: data.name,
  });

  revalidatePath("/management/integrations");
  // The raw key is returned ONLY here — it is never stored, and this response is the one
  // moment the caller can see it. create-api-key-dialog.tsx holds it in local state for the
  // one-time reveal step and never sends it anywhere else.
  return { ok: true as const, data: { id: data.id, name: data.name, rawKey: raw } };
}

export async function revokeApiKey(id: string) {
  const auth = await requirePermission("admin.manage_integrations");
  if (!auth.ok) return auth;

  const { data: key } = await auth.supabase.from("api_keys").select("name, status").eq("id", id).maybeSingle();
  if (!key || key.status !== "active") return { ok: false as const, error: "This key is already revoked" };

  const { error } = await auth.supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by: auth.userId })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await recordAuditEvent(auth.supabase, {
    actorId: auth.userId,
    actorEmail: auth.email,
    action: AUDIT_ACTION.API_KEY_REVOKE,
    entityType: AUDIT_ENTITY_TYPE.API_KEY,
    entityId: id,
    entityLabel: key.name,
  });

  revalidatePath("/management/integrations");
  return { ok: true as const };
}
