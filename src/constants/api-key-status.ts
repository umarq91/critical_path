import type { StatusBadgeConfig } from "@/components/shared/status-badge";

// api_keys.status — 'active' | 'revoked'. Same soft-fill + border + text token trio as
// USER_STATUS_CONFIG; "revoked" reads as the same semantic as "inactive" there (overdue/red)
// but keeps its own label since a key is revoked, never deactivated.
export const API_KEY_STATUS_CONFIG: StatusBadgeConfig = {
  active: {
    label: "Active",
    className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text",
  },
  revoked: {
    label: "Revoked",
    className: "border border-status-overdue-base bg-status-overdue-soft text-status-overdue-text",
  },
};
