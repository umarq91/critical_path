import "server-only";
import { randomBytes, createHash } from "crypto";

// "cpi" = Critical Path Integration — a recognisable prefix on the raw key, same idea as
// Stripe's `sk_live_`/GitHub's `ghp_`, so a key pasted somewhere is identifiable at a glance.
const KEY_PREFIX = "cpi_";
// How much of the raw key api_keys.key_prefix stores — the tag plus a handful of random chars,
// enough for an admin to recognise "yes, that's the key ending in a1b2..." without it being
// anywhere near enough entropy to matter if it leaked on its own.
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiKey {
  /** Shown to the caller exactly once — never stored anywhere. */
  raw: string;
  prefix: string;
  hash: string;
}

// 256 bits of randomness is the whole security model here — not a password, so no bcrypt/
// scrypt slow-hashing (that trades against brute-forcing a LOW-entropy human secret, which
// this isn't). SHA-256 is fast, deterministic, and looked up as an exact indexed match in
// api_keys.key_hash — same reasoning listed in things-to-know.md's Integrations section.
export function generateApiKey(): GeneratedApiKey {
  const raw = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { raw, prefix: raw.slice(0, DISPLAY_PREFIX_LENGTH), hash: hashApiKey(raw) };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
