import { z } from "zod";
import { ROLE, WORKSPACE_ROLES } from "@/constants/roles";

// Matches Supabase Auth's own default minimum, so a password accepted here can't then be
// rejected by the API. No character-class rules: length is the property that actually resists
// guessing, and an admin typing a password on someone else's behalf needs one they can pass on,
// not one that fails four different rules in sequence. Raising this floor is a one-line change
// here — it's the only place the rule is expressed.
const MIN_PASSWORD_LENGTH = 6;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72, "Password must be 72 characters or fewer");

export const externalUserSchema = z.object({
  email: z.email("Enter a valid email address"),
  full_name: z.string().min(1, "Name is required").max(120),
  password: passwordSchema,
  department_id: z.string().uuid().optional().or(z.literal("none")),
});

// Everything an admin may change on an existing account. `role` is constrained to the three
// Workspace roles: `external` is absent because account type is fixed at creation — an
// external account has a password and no Workspace identity, so converting it either way
// would leave someone unable to sign in. Enforced again server-side in _actions.ts, since a
// client-side schema is UX, not a security boundary.
export const userUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(120).optional(),
  department_id: z.string().uuid().nullable().optional().or(z.literal("none")),
  role: z.enum(WORKSPACE_ROLES).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export const ACCOUNT_TYPE = { WORKSPACE: "workspace", EXTERNAL: "external" } as const;

export function accountTypeOf(role: string) {
  return role === ROLE.EXTERNAL ? ACCOUNT_TYPE.EXTERNAL : ACCOUNT_TYPE.WORKSPACE;
}

export type ExternalUserInput = z.infer<typeof externalUserSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
