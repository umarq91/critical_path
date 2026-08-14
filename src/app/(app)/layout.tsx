import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/data/profiles";
import { ROUTES } from "@/constants/routes";
import { UserMenu } from "@/app/(app)/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // proxy.ts already guarantees a session; a missing profile here means the
  // on_auth_user_created trigger hasn't run yet (or failed) — bounce to sign-in rather
  // than rendering a shell with no identity to show.
  if (!profile) redirect(ROUTES.signIn);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">Critical Path</span>
        <UserMenu profile={profile} />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
