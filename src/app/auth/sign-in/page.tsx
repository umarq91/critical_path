import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleButton } from "@/app/auth/google-button";
import { ROUTES } from "@/constants/routes";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Something went wrong signing you in. Please try again.",
  domain: "Please sign in with your Threebyone Google Workspace account.",
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
          <p className="text-lg text-text-secondary">Sign in to continue to Critical Path</p>
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
          Use your company Google Workspace account to access the platform.
        </p>
      </CardContent>
    </Card>
  );
}
