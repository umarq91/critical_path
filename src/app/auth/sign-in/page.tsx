import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-h1">Critical Path</CardTitle>
        <CardDescription className="text-body text-text-secondary">
          Sign in with your Threebyone Google account
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <p className="text-caption text-status-overdue-text">{error}</p> : null}
        <GoogleButton next={next} />
      </CardContent>
    </Card>
  );
}
