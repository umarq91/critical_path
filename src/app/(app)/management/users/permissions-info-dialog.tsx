"use client";

import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE, ROLE_LABEL, type Role } from "@/constants/roles";
import { USER_ROLE_CONFIG } from "@/constants/user-account";
import { PERMISSION_CATALOG } from "@/constants/permission-catalog";
import { can } from "@/lib/permissions";

const MATRIX_ROLES: readonly Role[] = [ROLE.ADMIN, ROLE.STANDARD_USER, ROLE.VIEWER, ROLE.EXTERNAL];

const ROLE_SUMMARY: Record<Role, string> = {
  [ROLE.ADMIN]: "Full access, no exceptions",
  [ROLE.STANDARD_USER]: "Day-to-day task work",
  [ROLE.VIEWER]: "Read-only across the company",
  [ROLE.EXTERNAL]: "Password sign-in, own tasks only",
};

interface PermissionsInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PermissionsInfoDialog = ({ open, onOpenChange }: PermissionsInfoDialogProps) => {
  return (
    <FormDialog
      title="Role permissions"
      description="What each role can do. Administrators are allowed everything; the other three are explicit allow-lists."
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64">Permission</TableHead>
                {MATRIX_ROLES.map((role) => (
                  <TableHead key={role} className="min-w-36 text-center">
                    <div className="flex flex-col items-center gap-1 py-1">
                      <StatusBadge value={role} config={USER_ROLE_CONFIG} />
                      <span className="text-xs font-normal text-muted-foreground">{ROLE_SUMMARY[role]}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_CATALOG.map((group) => (
                <Fragment key={group.title}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={MATRIX_ROLES.length + 1} className="bg-muted py-2">
                      <span className="text-label text-text-secondary">{group.title}</span>
                    </TableCell>
                  </TableRow>
                  {group.entries.map((entry) => (
                    <TableRow key={entry.action}>
                      <TableCell className="align-top">
                        <div className="flex flex-col">
                          <span className="text-body-strong text-foreground">{entry.label}</span>
                          <span className="text-sm text-muted-foreground">{entry.description}</span>
                        </div>
                      </TableCell>
                      {MATRIX_ROLES.map((role) => {
                        const allowed = can(role, entry.action, entry.resource);
                        return (
                          <TableCell key={role} className="text-center align-middle">
                            <span className="sr-only">
                              {`${ROLE_LABEL[role]}: ${allowed ? "allowed" : "not allowed"}`}
                            </span>
                            {allowed ? (
                              <Check aria-hidden className="mx-auto size-4 text-status-complete-text" />
                            ) : (
                              <Minus aria-hidden className="mx-auto size-4 text-text-disabled" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">
          Role and sign-in method are one decision: External accounts use a password and can never
          be switched to a Workspace role, or the reverse. Task visibility is narrowed further by
          row-level security — an External user only ever sees tasks they are involved in.
        </p>
      </div>
    </FormDialog>
  );
};
