/**
 * Type definitions for the Antigravity proxy provider.
 * Aligned with the refactored /v1/quota-stats API schema.
 */

/** Configuration stored in ~/.config/opencode/usage-config.jsonc */
export type ProxyConfig = {
  endpoint: string
  apiKey?: string
  timeout?: number
  providers?: {
    openai?: boolean
    proxy?: boolean
  }
}

/** Time-windowed quota statistics (e.g., "5h", "1d") */
export type WindowStats = {
  request_count: number
  limit: number | null
  remaining: number
  reset_at: string | null
}

/** Quota group at provider level (e.g., Antigravity model groups) */
export type ProviderQuotaGroup = {
  baseline?: number
  remaining: number
  resets_at?: string
}

/** Credential information - aligned with new schema */
export type Credential = {
  stable_id: string
  display_name: string
  tier?: string
  priority: number
  active: boolean
  on_cooldown: boolean
  exhausted: boolean
  active_requests: number
  total_requests: number
  total_tokens: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_thinking_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  windows: Record<string, WindowStats>
}

/** Provider information - aligned with new schema */
export type Provider = {
  credential_count: number
  active_count: number
  on_cooldown_count: number
  exhausted_count: number
  total_requests: number
  total_tokens: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_thinking_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  approx_cost: number | null
  quota_groups?: Record<string, ProviderQuotaGroup>
  credentials: Credential[]
}

/** Summary statistics - aligned with new schema */
export type Summary = {
  total_requests: number
  total_tokens: number
  total_cost: number
}

/** Proxy limits response structure from /v1/quota-stats */
export type ProxyResponse = {
  providers: Record<string, Provider>
  summary: Summary
  data_source: string
  timestamp: number
}
