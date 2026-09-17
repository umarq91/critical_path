import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, type Role } from "@/constants/roles";

interface ProfileDetailsProps {
  fullName: string;
  email: string;
  role: Role;
  departmentName: string | null;
}

// Every field here is a disabled input, not plain text — same visual weight across the card so
// "you can see this but not touch it" reads at a glance instead of needing a caption per field.
// Name joined the rest of this read-only set once the client asked that users no longer edit
// their own display name — app-layer only (no updateOwnProfile Server Action, no schema), the
// same way this page never let anyone touch email/role/department. See things-to-know.md's
// General Settings section for why this stops at the app layer, unlike those three columns.
export const ProfileDetails = ({ fullName, email, role, departmentName }: ProfileDetailsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" value={fullName} disabled readOnly />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled readOnly />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-role">Role</Label>
        <Input id="profile-role" value={ROLE_LABEL[role]} disabled readOnly />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-department">Department</Label>
        <Input id="profile-department" value={departmentName ?? "No department"} disabled readOnly />
      </div>
    </div>
  );
};
