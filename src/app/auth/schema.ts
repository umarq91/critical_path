import { z } from "zod";

// Sign-in only. Deliberately NOT the same schema as management/users' create-user form: this
// one validates that something was typed, not that it's a strong password. Applying strength
// rules at sign-in would lock out an account whose password predates a rule change, and it
// leaks the password policy to anyone who can load the sign-in page.
export const passwordSignInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type PasswordSignInInput = z.infer<typeof passwordSignInSchema>;
