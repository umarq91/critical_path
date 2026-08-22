"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/icons/google-logo";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";
import { ROUTES } from "@/constants/routes";

export function GoogleButton({ next }: { next: string }) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClient();
    const callbackUrl = new URL(ROUTES.authCallback, publicEnv.NEXT_PUBLIC_APP_URL);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        // TEMPORARY — requesting Calendar access at sign-in (instead of a separate
        // "Connect Google Calendar" flow triggered from inside the app) is the per-user
        // OAuth stopgap for Calendar sync while dev/test accounts are personal @gmail.com
        // addresses, which domain-wide delegation can't reach (see lib/google/calendar.ts).
        // Once users move to a real Workspace domain, re-evaluate switching Calendar sync
        // back to domain-wide delegation (like admin-directory.ts's role sync already
        // uses) and drop this scope + the google_oauth_tokens table entirely.
        scopes: "https://www.googleapis.com/auth/calendar.events",
        queryParams: {
          // Narrows the Google account chooser to the workspace domain. Not a security
          // boundary on its own — the callback route re-verifies the signed-in email's
          // domain server-side, since `hd` can be bypassed client-side.
          hd: publicEnv.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN,
          // consent (not just select_account) is required every sign-in to reliably get a
          // refresh_token back — Google only issues one on the first-ever consent otherwise.
          access_type: "offline",
          prompt: "select_account consent",
        },
      },
    });

    if (error) setIsLoading(false);
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant="outline"
      size="lg"
      className="h-12 w-full gap-2 border-border-strong text-base font-semibold"
    >
      <GoogleLogo className="size-6" />
      {isLoading ? "Redirecting…" : "Sign in with Google Workspace"}
    </Button>
  );
}
