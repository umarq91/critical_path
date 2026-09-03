import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/data/profiles";
import { ROUTES } from "@/constants/routes";
import { UserMenu } from "@/app/(app)/user-menu";
import { AppSidebar } from "@/app/(app)/app-sidebar";
import { DeactivatedNotice } from "@/app/(app)/deactivated-notice";
import { NavSearch } from "@/app/(app)/nav-search";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // proxy.ts already guarantees a session; a missing profile here means the
  // on_auth_user_created trigger hasn't run yet (or failed) — bounce to sign-in rather
  // than rendering a shell with no identity to show.
  if (!profile) redirect(ROUTES.signIn);

  // A deactivated account keeps a valid session until it expires, so this is the point where
  // the app refuses to render for them. RLS (is_active_user(), 0018) is the real boundary —
  // this just explains why everything would otherwise be empty.
  if (profile.status !== "active") return <DeactivatedNotice email={profile.email} />;

  return (
    <SidebarProvider>
      <AppSidebar role={profile.role} />
      {/* min-w-0 + overflow-x-hidden: without them this flex child sizes to its widest
          descendant (min-width defaults to auto), so a wide table drags the whole shell —
          header and page chrome included — into a horizontal scroll. Constrained here,
          overflow stays inside whichever child owns its own scroll container. */}
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-4">
          <SidebarTrigger />
          <div className="flex flex-1 items-center">
            <NavSearch />
          </div>
          <UserMenu profile={profile} />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
