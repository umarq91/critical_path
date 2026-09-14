import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileForm } from "@/app/(app)/settings/general/profile-form";
import { requirePageAccess } from "@/lib/require-page-access";

// Gated on "profile.update_own" (granted to every role) rather than "admin.manage_lookups" —
// this page is "manage your own account," open to everyone, unlike the rest of Settings.
export default async function SettingsGeneralPage() {
  const profile = await requirePageAccess("profile.update_own");

  return (
    <div className="flex flex-col">
      <PageHeader title="General Settings" description="Your account details." />
      <div className="px-6 pb-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your display name. Email, role, and department are managed by your organisation and can&apos;t be
              changed here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              fullName={profile.full_name ?? ""}
              email={profile.email}
              role={profile.role}
              departmentName={profile.department?.name ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
