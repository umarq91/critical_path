import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { SIGN_IN_CODE_TTL_MINUTES } from "@/constants/sign-in-code";
import { getSignInCodeState } from "@/lib/sign-in-code";
import { AuthBrand } from "@/app/auth/auth-brand";
import { VerifyCodeForm } from "@/app/auth/verify/verify-code-form";

// Only same-origin paths — `next` comes from the URL, and "//evil.com" is a protocol-relative
// absolute URL, not a path.
function safeNext(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return ROUTES.dashboard;
  return value;
}

export default async function VerifySignInPage({ searchParams }: PageProps<"/auth/verify">) {
  const next = safeNext((await searchParams).next);
  const state = await getSignInCodeState();

  if (state.kind === "signed_out") redirect(ROUTES.signIn);
  if (state.kind === "not_required") redirect(next);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <AuthBrand />
      <Card className="w-full shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 px-10 py-12 text-center xl:px-14">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
            {state.hasLiveCode ? (
              <p className="text-sm text-muted-foreground">
                We sent a sign-in code to <span className="font-medium text-foreground">{state.email}</span>. It
                expires in {SIGN_IN_CODE_TTL_MINUTES} minutes.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Send a sign-in code to <span className="font-medium text-foreground">{state.email}</span> to
                continue.
              </p>
            )}
          </div>
          <VerifyCodeForm next={next} initialResendInSeconds={state.resendInSeconds} />
        </CardContent>
      </Card>
    </div>
  );
}
