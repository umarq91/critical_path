"use client";

import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { AuditChangeSummary } from "@/app/(app)/management/logs/audit-change-summary";
import { AUDIT_ACTION_CONFIG } from "@/constants/audit";
import { formatDateTime } from "@/lib/dates";
import type { AuditEvent } from "@/data/audit-log";

interface LogDetailDialogProps {
  event: AuditEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The whole entry, unabbreviated — the table cell caps how many changes it shows, this doesn't.
// Read-only by design: the log is append-only (0020 grants no update or delete policy), so
// there is nothing here to edit or dismiss.
export const LogDetailDialog = ({ event, open, onOpenChange }: LogDetailDialogProps) => {
  const actorName = event.actor?.full_name ?? event.actor?.email ?? event.actor_email ?? "Deleted user";

  return (
    <FormDialog
      title={event.entity_label ?? "Untitled task"}
      description={formatDateTime(event.created_at)}
      open={open}
      onOpenChange={onOpenChange}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-muted/40 p-4">
          <DetailRow label="Action">
            <StatusBadge value={event.action} config={AUDIT_ACTION_CONFIG} />
          </DetailRow>
          <DetailRow label="Person">
            <span className="text-body text-foreground">{actorName}</span>
          </DetailRow>
          <DetailRow label="When">
            <span className="text-body text-foreground">{formatDateTime(event.created_at)}</span>
          </DetailRow>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label text-muted-foreground">What changed</span>
          <AuditChangeSummary changes={event.changes} />
        </div>
      </div>
    </FormDialog>
  );
};

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-label text-muted-foreground">{label}</span>
    {children}
  </div>
);
