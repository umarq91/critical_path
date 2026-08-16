"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { seasonSchema } from "@/app/(app)/seasons/schema";

export async function createSeason(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !can(profile.role, "admin.manage_lookups")) {
    return { ok: false as const, error: "Only an admin can create seasons" };
  }

  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data, error } = await supabase
    .from("seasons")
    .insert({ ...parsed.data, owner_id: user.id })
    .select()
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/seasons");
  return { ok: true as const, data };
}
