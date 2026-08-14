import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserRole } from "@/lib/google/admin-directory";
import { publicEnv } from "@/lib/env";
import { ROUTES } from "@/constants/routes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? ROUTES.dashboard;

  if (!code) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=auth`, url.origin));
  }

  if (!user.email.toLowerCase().endsWith(`@${publicEnv.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`${ROUTES.signIn}?error=domain`, url.origin));
  }

  // Service-role write, deliberately bypassing the self-role-change guard on `profiles`
  // (see migration 0001) — a brand-new user is very often not an admin yet, which is
  // exactly why their role needs to come from an authoritative external source (Google
  // Groups) instead of the profiles row they don't get to edit themselves.
  const resolvedRole = await resolveUserRole(user.email);
  if (resolvedRole) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ role: resolvedRole }).eq("id", user.id);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
