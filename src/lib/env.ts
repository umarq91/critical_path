import { z } from "zod";

// Client-safe env only. Never add a non-`NEXT_PUBLIC_` var here — this module is imported
// by src/lib/supabase/client.ts, which ships to the browser. Server secrets live in
// env.server.ts instead.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN: z.string().min(1),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN: process.env.NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN,
});
