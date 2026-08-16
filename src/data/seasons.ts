import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listSeasons() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("*, owner:profiles(id, full_name, email, avatar_url)")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error) throw error;
  return data;
}

export type Season = Awaited<ReturnType<typeof listSeasons>>[number];
