import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { PROTECTED_PREFIXES, ROUTES } from "@/constants/routes";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthCallback = pathname === ROUTES.authCallback;

  if (isProtected && !user) {
    const signInUrl = new URL(ROUTES.signIn, request.url);
    // Search included so a deep link (e.g. a reminder email's /my-tasks?task=<id>) survives sign-in.
    signInUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/auth") && !isAuthCallback && user) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, image optimization, and metadata files — running the Supabase
    // session refresh on those would just add latency for no benefit.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
