import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]),
});

export const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});
