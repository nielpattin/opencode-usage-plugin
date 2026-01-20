/**
 * Copilot usage provider schemas and auth shape.
 * Keeps parsing types isolated from fetch logic.
 */

import z from "zod"

export type CopilotAuth = {
  access?: string
  refresh?: string
  usageToken?: string
}

export const copilotTokenSchema = z.object({
  sku: z.string().optional(),
  limited_user_quotas: z
    .object({
      chat: z.number(),
      completions: z.number(),
    })
    .optional(),
  limited_user_reset_date: z.number().optional(),
  token: z.string().optional(),
})

export type CopilotV2TokenResponse = z.infer<typeof copilotTokenSchema>

export const copilotQuotaSnapshotSchema = z.object({
  entitlement: z.number(),
  remaining: z.number(),
  percent_remaining: z.number(),
  quota_id: z.string(),
})

export type CopilotQuotaSnapshot = z.infer<typeof copilotQuotaSnapshotSchema>

export const copilotUserSchema = z.object({
  access_type_sku: z.string().optional(),
  copilot_plan: z.string().optional(),
  quota_snapshots: z
    .object({
      premium_interactions: copilotQuotaSnapshotSchema.optional().nullable(),
      chat: copilotQuotaSnapshotSchema.optional().nullable(),
    })
    .optional(),
  quota_reset_date: z.union([z.string(), z.number()]).optional(),
  limited_user_quotas: z
    .object({
      chat: z.number(),
      completions: z.number(),
    })
    .optional(),
  limited_user_reset_date: z.union([z.string(), z.number()]).optional(),
  monthly_quotas: z
    .object({
      chat: z.number(),
      completions: z.number(),
    })
    .optional(),
})

export type CopilotUserResponse = z.infer<typeof copilotUserSchema>
