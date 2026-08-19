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

export const updateAlertSettingsSchema = z.object({
  ciFailure: z.boolean(),
  prWaitingDays: z.number().int().min(0).max(365),
  issueInactiveDays: z.number().int().min(0).max(365),
  healthScoreThreshold: z.number().int().min(0).max(100),
  emailEnabled: z.boolean(),
});
