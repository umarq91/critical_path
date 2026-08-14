import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/data/profiles";
import { ROUTES } from "@/constants/routes";
import { UserMenu } from "@/app/(app)/user-menu";
import { AppSidebar } from "@/app/(app)/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  // proxy.ts already guarantees a session; a missing profile here means the
  // on_auth_user_created trigger hasn't run yet (or failed) — bounce to sign-in rather
  // than rendering a shell with no identity to show.
  if (!profile) redirect(ROUTES.signIn);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
          </div>
          <UserMenu profile={profile} />
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
