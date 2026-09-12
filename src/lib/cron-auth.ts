import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCronSecret } from "@/lib/env.server";

/**
 * First line of every `app/api/cron/*` route. The caller here is never a signed-in user —
 * Supabase pg_cron's `net.http_post` for this app's routes, not a browser — so there's no
 * session to check; a shared secret in the `Authorization` header is the only guard. Returns a
 * ready-to-return 401 response on failure so a route can `const denied = requireCronAuth(request);
 * if (denied) return denied;` in one line.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const expected = `Bearer ${getCronSecret()}`;
  const actual = request.headers.get("authorization");
  if (actual !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
