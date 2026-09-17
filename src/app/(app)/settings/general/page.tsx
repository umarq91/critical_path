import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProfileDetails } from "@/app/(app)/settings/general/profile-details";
import { requirePageAccess } from "@/lib/require-page-access";

// Gated on "profile.update_own" (granted to every role) rather than "admin.manage_lookups" —
// this page is "see your own account," open to everyone, unlike the rest of Settings. It's
// read-only in full now: name joined email/role/department as a field an admin manages instead
// (/management/users), per client request — see things-to-know.md's General Settings section.
export default async function SettingsGeneralPage() {
  const profile = await requirePageAccess("profile.update_own");

  return (
    <div className="flex flex-col">
      <PageHeader title="General Settings" description="Your account details." />
      <div className="px-6 pb-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Managed by your organisation. Contact an admin to change any of these.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileDetails
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
