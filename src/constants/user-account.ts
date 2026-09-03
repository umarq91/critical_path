import type { StatusBadgeConfig } from "@/components/shared/status-badge";
import { ROLE, ROLE_LABEL } from "@/constants/roles";

// profiles.status — 'active' | 'inactive'. Same soft-fill + border + text token trio as
// BRAND_STATUS_CONFIG; nothing here is a new colour.
export const USER_STATUS_CONFIG: StatusBadgeConfig = {
  active: {
    label: "Active",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  inactive: {
    label: "Inactive",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
};

// How an account authenticates, derived from its role rather than stored separately — see
// accountTypeOf() in management/users/schema.ts and the note in constants/roles.ts.
export const ACCOUNT_TYPE_CONFIG: StatusBadgeConfig = {
  // External is the exceptional case, so it's the one that carries colour — a Workspace
  // account is the norm and reads as neutral.
  workspace: {
    label: "Google Workspace",
    className: "border border-border-strong bg-muted text-text-secondary",
  },
  external: {
    label: "External",
    className: "border border-prio-med bg-prio-med-soft text-foreground",
  },
};

export const USER_ROLE_CONFIG: StatusBadgeConfig = {
  [ROLE.ADMIN]: {
    label: ROLE_LABEL[ROLE.ADMIN],
    className: "border border-border-strong bg-primary-tint text-primary",
  },
  [ROLE.STANDARD_USER]: {
    label: ROLE_LABEL[ROLE.STANDARD_USER],
    className: "border border-border-strong bg-muted text-foreground",
  },
  [ROLE.VIEWER]: {
    label: ROLE_LABEL[ROLE.VIEWER],
    className: "border border-border bg-muted text-muted-foreground",
  },
  [ROLE.EXTERNAL]: {
    label: ROLE_LABEL[ROLE.EXTERNAL],
    className: "border border-prio-med bg-prio-med-soft text-foreground",
  },
};
