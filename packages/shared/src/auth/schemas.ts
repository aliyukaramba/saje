import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Passwords: minimum 10 characters. Length over complexity rules (NIST SP 800-63B).
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
