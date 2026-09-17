// Shared between password-form.tsx (client) and auth/callback/route.ts (server) — both need to
// tell a deactivated (banned) account's sign-in failure apart from every other kind. `.code` is
// the documented Supabase Auth error code ("user_banned"), but isn't reliably populated for
// every rejection path on every GoTrue version, so the message substring is a real fallback,
// not redundant belt-and-suspenders.
export function isBannedError(error: { code?: string; message: string }): boolean {
  return error.code === "user_banned" || error.message.toLowerCase().includes("banned");
}
