import { UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/_actions";

// Shown instead of the app shell when a signed-in account has been deactivated. It is a
// rendered screen rather than a redirect to /auth/sign-in on purpose: the session is still
// technically valid, so proxy.ts would bounce them straight back to /dashboard and the two
// redirects would ping-pong. Signing out here is what actually ends the loop.
//
// This is a courtesy, not the enforcement. Access is revoked by is_active_user() in the RLS
// policies (0018) and by requirePermission(); a deactivated user who never loads this page
// still cannot read or write anything.
export const DeactivatedNotice = ({ email }: { email: string }) => {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-status-overdue-soft">
            <UserX className="size-7 text-status-overdue-text" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-h2 text-foreground">Account deactivated</h1>
            <p className="text-body text-text-secondary">
              Access for {email} has been turned off. Contact an administrator if you think this is
              a mistake.
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
