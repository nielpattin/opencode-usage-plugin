/**
 * Core type definitions for the Usage Tracking Plugin.
 */

export const PlanTypes = [
  "guest",
  "free",
  "go",
  "plus",
  "pro",
  "max",
  "max_5x",
  "max_20x",
  "free_workspace",
  "team",
  "business",
  "education",
  "quorum",
  "k12",
  "enterprise",
  "edu",
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

export interface CopilotQuota {
  used: number
  total: number
  percentRemaining: number
  resetTime?: string | null
  completionsUsed?: number
  completionsTotal?: number
}

export interface ProxyQuotaGroup {
  name: string
  remaining: number
  max: number
  remainingPct: number
  resetTime?: string | null
}

export interface ProxyTierInfo {
  tier: "paid" | "free"
  quotaGroups: ProxyQuotaGroup[]
}

export interface ProxyProviderInfo {
  name: string
  tiers: ProxyTierInfo[]
}

export interface ProxyQuota {
  providers: ProxyProviderInfo[]
  totalCredentials: number
  activeCredentials: number
  dataSource: string
}

export interface UsageConfig {
  endpoint?: string
  apiKey?: string
  zaiEndpoint?: string
  timeout?: number
  providers?: {
    openai?: boolean
    anthropic?: boolean
    proxy?: boolean
    copilot?: boolean
    zai?: boolean
  }
  modelGroups?: {
    showAll?: boolean
    displayNames?: Record<string, string>
  }
}

export interface ZaiQuota {
  limits: Array<{
    type: string
    usage: number
    currentValue: number
    remaining: number
    percentage: number
    nextResetTime?: number
    usageDetails?: Array<{ modelCode: string; usage: number }>
  }>
  modelUsage?: {
    totalModelCallCount: number
    totalTokensUsage: number
  }
  toolUsage?: {
    totalNetworkSearchCount: number
    totalWebReadMcpCount: number
    totalZreadMcpCount: number
  }
}

export interface AnthropicLimit {
  key: string
  label: string
  utilization: number
  resetsAt: string | null
}

export interface AnthropicExtraUsage {
  isEnabled: boolean
  monthlyLimit: string | null
  usedCredits: string | null
  utilization: number | null
}

export interface AnthropicSubscriptionMeta {
  organizationType: string | null
  rateLimitTier: string | null
  subscriptionStatus: string | null
  hasClaudeMax: boolean
  hasClaudePro: boolean
}

export interface AnthropicQuota {
  limits: AnthropicLimit[]
  extraUsage: AnthropicExtraUsage | null
  subscription: AnthropicSubscriptionMeta | null
}

export interface UsageSnapshot {
  timestamp: number
  provider: string
  planType: PlanType | null
  primary: RateLimitWindow | null
  secondary: RateLimitWindow | null
  codeReview: RateLimitWindow | null
  credits: CreditsSnapshot | null
  proxyQuota?: ProxyQuota
  copilotQuota?: CopilotQuota
  zaiQuota?: ZaiQuota
  anthropicQuota?: AnthropicQuota
  updatedAt: number
  isMissing?: boolean
  missingReason?: string
  missingDetails?: string[]
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
