import { z } from "zod";
import { SIGN_IN_CODE_LENGTH } from "@/constants/sign-in-code";

export const signInCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${SIGN_IN_CODE_LENGTH}}$`), `Enter the ${SIGN_IN_CODE_LENGTH}-digit code from the email`),
});

export type SignInCodeInput = z.infer<typeof signInCodeSchema>;
