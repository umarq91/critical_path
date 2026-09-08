"use client";

import { PARTICIPANT_ROLE_LABEL, TASK_FIELD_LABEL } from "@/constants/audit";
import type { AuditChanges, AuditFieldChange } from "@/types/audit";

interface AuditChangeSummaryProps {
  changes: AuditChanges;
  /** Cap on rows rendered before a "+n more" hint. Omitted renders everything (the dialog). */
  limit?: number;
}

const NOT_SET = "—";

// The one renderer for `audit_log.changes`, used by both the table cell (limited) and the
// detail dialog (unlimited) — the shape is the same, only how much of it fits differs.
export const AuditChangeSummary = ({ changes, limit }: AuditChangeSummaryProps) => {
  const { fields = [], parties = [], owners = [], backfilled } = changes;

  if (backfilled) {
    return (
      <span className="text-sm text-muted-foreground">
        Recorded from the task&apos;s own tracking columns — no field detail available
      </span>
    );
  }

  if (owners.length > 0) {
    return (
      <span className="text-sm text-foreground">
        Owner: <span className="text-body-strong">{owners.join(", ")}</span>
      </span>
    );
  }

  // One save of the drawer touches owners, people involved, or both — so every role that
  // changed is listed here, in the one row, rather than split across entries.
  if (parties.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        {parties.map((party) => (
          <div key={party.role} className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-muted-foreground">{PARTICIPANT_ROLE_LABEL[party.role] ?? party.role}:</span>
            {party.added.map((name) => (
              <PartyChip key={`added-${name}`} name={name} direction="added" />
            ))}
            {party.removed.map((name) => (
              <PartyChip key={`removed-${name}`} name={name} direction="removed" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (fields.length === 0) return <span className="text-sm text-muted-foreground">{NOT_SET}</span>;

  const visible = limit ? fields.slice(0, limit) : fields;
  const hidden = fields.length - visible.length;

  return (
    <div className="flex flex-col gap-1">
      {visible.map((change) => (
        <FieldChangeRow key={change.field} change={change} />
      ))}
      {hidden > 0 ? <span className="text-xs text-muted-foreground">+{hidden} more</span> : null}
    </div>
  );
};

const FieldChangeRow = ({ change }: { change: AuditFieldChange }) => (
  <span className="text-sm text-foreground">
    <span className="text-muted-foreground">{TASK_FIELD_LABEL[change.field] ?? change.field}: </span>
    <span className="line-through decoration-border-strong">{change.from ?? NOT_SET}</span>
    <span className="px-1 text-muted-foreground">&rarr;</span>
    <span className="text-body-strong">{change.to ?? NOT_SET}</span>
  </span>
);

const PartyChip = ({ name, direction }: { name: string; direction: "added" | "removed" }) => (
  <span
    className={
      direction === "added"
        ? "rounded-full border border-status-complete-base bg-status-complete-soft px-2 py-0.5 text-xs text-status-complete-text"
        : "rounded-full border border-status-overdue-base bg-status-overdue-soft px-2 py-0.5 text-xs text-status-overdue-text"
    }
  >
    {direction === "added" ? "+" : "−"} {name}
  </span>
);
