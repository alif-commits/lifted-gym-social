import { z } from "zod";
import { RESERVED_USERNAMES, USERNAME_REGEX } from "@/lib/constants";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_REGEX, "3-20 characters: lowercase letters, numbers and underscores")
  .refine((u) => !RESERVED_USERNAMES.has(u), "This username is reserved");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Include at least one letter and one number");

export const emailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email("Enter a valid email"));

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  timezone: z.string().max(64).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Enter your email or username").max(320),
  password: z.string().min(1, "Enter your password").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal("DELETE"),
});
