-- 0001 was already applied with the role value 'manager'. Renaming the client's chosen
-- label to "Standard User" (src/constants/roles.ts) means renaming the enum value itself
-- to avoid a discrepancy between the label and the underlying identifier — done in place
-- with RENAME VALUE rather than dropping/recreating the type, so any existing profiles.role
-- rows already set to 'manager' are relabelled automatically with no data loss.
alter type public.user_role rename value 'manager' to 'standard_user';
