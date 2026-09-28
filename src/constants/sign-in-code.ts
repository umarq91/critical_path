// External-account sign-in code (supabase/migrations/0032_external_sign_in_code.sql). Shared by
// the server logic that issues/checks codes and the /auth/verify screen that describes them.
export const SIGN_IN_CODE_LENGTH = 6;
export const SIGN_IN_CODE_TTL_MINUTES = 5;
export const SIGN_IN_CODE_RESEND_COOLDOWN_SECONDS = 60;
// Counted per sign-in, not per code: a resend doesn't reset it, or 5 guesses a minute would be
// unlimited guesses.
export const SIGN_IN_CODE_MAX_ATTEMPTS = 5;
export const SIGN_IN_SUPPORT_EMAIL = "techsupport@threebyone.com.au";
