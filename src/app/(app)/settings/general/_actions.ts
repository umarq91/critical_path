"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { profileUpdateSchema } from "@/app/(app)/settings/general/schema";

// Gated on "profile.update_own" (granted to every role) rather than an admin action — a person
// may change only their own display name here. Email, role, department, and status are excluded
// from the schema entirely, not just hidden in the UI: profiles_guard (0004/0018) rejects
// anyone but admin/service-role changing those columns, even on their own row, so this action
// would fail against the database if it tried.
export async function updateOwnProfile(input: unknown) {
  const auth = await requirePermission("profile.update_own");
  if (!auth.ok) return auth;

  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await auth.supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", auth.userId);
  if (error) return { ok: false as const, error: error.message };

  // Full layout revalidation, not just this page — full_name also renders in the sidebar's
  // UserMenu (app/(app)/layout.tsx), on every route, not only here.
  revalidatePath("/", "layout");
  return { ok: true as const };
}
