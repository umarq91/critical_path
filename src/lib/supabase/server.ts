import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";
import { publicEnv } from "@/lib/env";

// RSC, Server Actions, and Route Handlers only. Each call returns a fresh per-request
// client scoped to the caller's session, so RLS applies exactly as it would for that
// user — never share this across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Thrown when called from a Server Component (cookies are read-only there).
            // Safe to ignore — src/proxy.ts refreshes the session cookie on every request.
          }
        },
      },
    },
  );
}
