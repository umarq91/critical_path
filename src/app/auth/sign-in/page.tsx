import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/app/auth/google-button";
import { PasswordForm } from "@/app/auth/password-form";
import { ROUTES } from "@/constants/routes";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Something went wrong signing you in. Please try again.",
  domain: "Please sign in with your Threebyone Google Workspace account.",
  external_account:
    "This account signs in with an email and password, not with Google. Use the form below.",
  deactivated: "Unable to log in, please contact techsupport@threebyone.com.au",
};

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : ROUTES.dashboard;
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardContent className="flex flex-col items-center gap-6 px-10 py-12 text-center xl:px-14">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary-tint">
          <Lock className="size-9 text-primary" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold text-foreground">Welcome Back</h1>
          <p className="text-lg text-text-secondary">Sign in to continue to Three by one</p>
        </div>

        {error ? (
          <p className="w-full rounded-md bg-status-overdue-soft px-3 py-2 text-sm text-status-overdue-text">
            {error}
          </p>
        ) : null}

        <div className="w-full pt-2">
          <GoogleButton next={next} />
        </div>

        <p className="text-sm text-muted-foreground">
          Threebyone staff: use your company Google Workspace account.
        </p>

        {/* Two sign-in paths, not two ways into the same one: Google is for Workspace staff,
            the password form is for external users an admin created. An account only ever
            has one of them — see auth/callback/route.ts. */}
        <div className="flex w-full items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          <span className="text-overline text-muted-foreground">External users</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <PasswordForm next={next} />
      </CardContent>
    </Card>
  );
}
