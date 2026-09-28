import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { publicEnv } from "@/lib/env";
import { getServiceRoleKey } from "@/lib/env.server";

// Service-role client — bypasses RLS entirely. Import only from Route Handlers that
// genuinely need system-level access (cron jobs, exports), never from Server Actions
// serving a single user's request — those use lib/supabase/server.ts so RLS applies. The
// sanctioned exceptions are createExternalUser (auth.admin.createUser) and lib/sign-in-code.ts
// (session_verifications must be unwritable by the user it verifies).
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
