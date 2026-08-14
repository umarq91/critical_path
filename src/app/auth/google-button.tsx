"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
        queryParams: {
          // Narrows the Google account chooser to the workspace domain. Not a security
          // boundary on its own — the callback route re-verifies the signed-in email's
          // domain server-side, since `hd` can be bypassed client-side.
          hd: publicEnv.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN,
          prompt: "select_account",
        },
      },
    });

    if (error) setIsLoading(false);
  }

  return (
    <Button onClick={handleClick} disabled={isLoading} className="w-full" size="lg">
      {isLoading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
