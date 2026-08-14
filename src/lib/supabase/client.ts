import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { publicEnv } from "@/lib/env";

// Client Components only. Each call returns a fresh client — never cache/reuse across
// requests or module scope.
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
