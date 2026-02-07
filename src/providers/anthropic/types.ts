/**
 * Type definitions for the Anthropic subscription usage provider.
 * Covers all plan tiers: Free, Pro, Max, Team, Enterprise.
 */

/** Auth credentials for Anthropic OAuth */
export interface AnthropicAuth {
  access: string
  refresh?: string
}

/** A single usage window from the /api/oauth/usage endpoint */
export interface AnthropicUsageWindow {
  utilization: number
  resets_at: string | null
}

/** Extra usage (overages) info for paid plans */
export interface AnthropicExtraUsage {
  is_enabled: boolean
  monthly_limit: number | null
  used_credits: number | null
  utilization: number | null
}

/** Raw response from GET /api/oauth/usage */
export interface AnthropicUsageResponse {
  five_hour: AnthropicUsageWindow | null
  seven_day: AnthropicUsageWindow | null
  seven_day_oauth_apps: AnthropicUsageWindow | null
  seven_day_opus: AnthropicUsageWindow | null
  seven_day_sonnet: AnthropicUsageWindow | null
  seven_day_cowork: AnthropicUsageWindow | null
  iguana_necktie: AnthropicUsageWindow | null
  extra_usage: AnthropicExtraUsage | null
}

/** Account info from the profile endpoint */
export interface AnthropicAccount {
  uuid: string
  full_name: string
  display_name: string
  email: string
  has_claude_max: boolean
  has_claude_pro: boolean
  created_at: string
}

/** Organization info from the profile endpoint */
export interface AnthropicOrganization {
  uuid: string
  name: string
  organization_type: string
  billing_type: string
  rate_limit_tier: string
  has_extra_usage_enabled: boolean
  subscription_status: string
  subscription_created_at: string
}

/** Raw response from GET /api/oauth/profile */
export interface AnthropicProfileResponse {
  account: AnthropicAccount
  organization: AnthropicOrganization
}

/** Resolved plan tier for display purposes */
export type AnthropicPlanTier =
  | "free"
  | "pro"
  | "max"
  | "team"
  | "enterprise"
  | "unknown"
