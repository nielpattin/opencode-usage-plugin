/**
 * Core type definitions for the Usage Tracking Plugin.
 */

export const PlanTypes = [
  "guest",
  "free",
  "go",
  "plus",
  "pro",
  "free_workspace",
  "team",
  "business",
  "education",
  "quorum",
  "k12",
  "enterprise",
  "edu",
  // Copilot specific
  "free_limited_copilot",
  "copilot_individual",
  "copilot_business",
  "copilot_enterprise",
] as const

export type PlanType = (typeof PlanTypes)[number]

export interface RateLimitWindow {
  usedPercent: number
  windowMinutes: number | null
  resetsAt: number | null
}

export interface CreditsSnapshot {
  hasCredits: boolean
  unlimited: boolean
  balance: string | null
}

// Copilot quota info from GitHub API
export interface CopilotQuota {
  chat: number | null // Monthly chat limit
  completions: number | null // Monthly completions limit
  resetAt: number | null // Unix timestamp when quota resets
}

export interface UsageSnapshot {
  timestamp: number
  provider: string
  planType: PlanType | null
  primary: RateLimitWindow | null
  secondary: RateLimitWindow | null
  codeReview: RateLimitWindow | null
  credits: CreditsSnapshot | null
  // Copilot specific fields
  quota?: CopilotQuota
  updatedAt: number
}

export interface UsageEntry {
  id: string
  timestamp: number
  provider: string
  model: string
  sessionID: string
  agent?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  cost?: number
  requestID?: string
  statusCode?: number
  latency?: number
}

export interface TokenUsage {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}
