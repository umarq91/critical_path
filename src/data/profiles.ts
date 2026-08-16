import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// cache() memoizes per-request — (app)/layout.tsx calls this for the auth guard/UserMenu,
// and individual pages call it again for role checks (e.g. seasons/page.tsx's
// canCreateSeason). Without this, that's two auth.getUser() + profile SELECT round trips
// for the same data on every request.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, department, status, created_at")
    .eq("id", user.id)
    .single();

  return profile;
});
