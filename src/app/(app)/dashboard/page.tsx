import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/data/profiles";
import { ROLE_LABEL } from "@/constants/roles";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
          <CardDescription>Task management, calendar, and reporting land here next.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {profile?.full_name ?? profile?.email} · {profile ? ROLE_LABEL[profile.role] : ""}
        </CardContent>
      </Card>
    </div>
  );
}
