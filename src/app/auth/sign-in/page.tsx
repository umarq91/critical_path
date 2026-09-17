import Image from "next/image";
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
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <Image
          src="/icons/logo.jpeg"
          alt="Three by one"
          width={1600}
          height={328}
          priority
          className="h-14 w-auto object-contain"
        />
        {/* Same treatment as the sidebar's wordmark (app-sidebar.tsx) — same hex, sampled from
            the logo's own ink, so both instances of this text match the logo exactly. */}
        <span className="text-2xl font-bold uppercase tracking-[0.02em] text-[#393A3C]">Critical Path</span>
        {/* <p className="text-sm text-muted-foreground">Threebyone Pty Ltd</p> */}
      </div>

      <Card className="w-full shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 px-10 py-12 text-center xl:px-14">
          <h1 className="text-2xl font-bold text-foreground">Sign In</h1>

          {error ? (
            <p className="w-full rounded-md bg-status-overdue-soft px-3 py-2 text-sm text-status-overdue-text">
              {error}
            </p>
          ) : null}

          <div className="w-full pt-2">
            <GoogleButton next={next} />
          </div>

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
    </div>
  );
}
