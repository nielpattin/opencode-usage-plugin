/**
 * Anthropic subscription provider for usage tracking.
 * Supports Free, Pro, Max, Team, and Enterprise plan tiers.
 * Fetches usage windows (5h, 7d, opus, sonnet, cowork) and profile data.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, AnthropicQuota } from "../../types"
import type { AnthropicAuth, AnthropicPlanTier, AnthropicProfileResponse, AnthropicUsageResponse } from "./types"
import { fetchAnthropicUsage, fetchAnthropicProfile } from "./fetch"

export type { AnthropicAuth } from "./types"

/**
 * Resolve the plan tier from the profile response.
 * Handles all known Anthropic subscription types.
 */
function resolvePlanTier(profile: AnthropicProfileResponse | null): AnthropicPlanTier {
  if (!profile) return "unknown"

  const { account, organization } = profile
  const orgType = organization.organization_type?.toLowerCase() ?? ""

  if (orgType.includes("enterprise")) return "enterprise"
  if (orgType.includes("team")) return "team"
  if (account.has_claude_max) return "max"
  if (account.has_claude_pro) return "pro"
  if (orgType.includes("pro")) return "pro"
  if (orgType.includes("max")) return "max"
  if (orgType.includes("free")) return "free"

  return "unknown"
}

/**
 * Build the AnthropicQuota from the usage response.
 * Captures all usage windows including model-specific ones.
 */
function buildAnthropicQuota(usage: AnthropicUsageResponse, profile: AnthropicProfileResponse | null) {
  return {
    fiveHour: usage.five_hour
      ? { utilization: usage.five_hour.utilization, resetsAt: usage.five_hour.resets_at }
      : null,
    sevenDay: usage.seven_day
      ? { utilization: usage.seven_day.utilization, resetsAt: usage.seven_day.resets_at }
      : null,
    sevenDayOAuthApps: usage.seven_day_oauth_apps
      ? { utilization: usage.seven_day_oauth_apps.utilization, resetsAt: usage.seven_day_oauth_apps.resets_at }
      : null,
    sevenDayOpus: usage.seven_day_opus
      ? { utilization: usage.seven_day_opus.utilization, resetsAt: usage.seven_day_opus.resets_at }
      : null,
    sevenDaySonnet: usage.seven_day_sonnet
      ? { utilization: usage.seven_day_sonnet.utilization, resetsAt: usage.seven_day_sonnet.resets_at }
      : null,
    sevenDayCowork: usage.seven_day_cowork
      ? { utilization: usage.seven_day_cowork.utilization, resetsAt: usage.seven_day_cowork.resets_at }
      : null,
    iguanaNecktie: usage.iguana_necktie
      ? { utilization: usage.iguana_necktie.utilization, resetsAt: usage.iguana_necktie.resets_at }
      : null,
    extraUsage: usage.extra_usage
      ? {
          isEnabled: usage.extra_usage.is_enabled,
          monthlyLimit: usage.extra_usage.monthly_limit,
          usedCredits: usage.extra_usage.used_credits,
          utilization: usage.extra_usage.utilization,
        }
      : null,
    planTier: resolvePlanTier(profile),
    organizationType: profile?.organization.organization_type ?? null,
    subscriptionStatus: profile?.organization.subscription_status ?? null,
    accountEmail: profile?.account.email ?? null,
  }
}



export const AnthropicProvider: UsageProvider<AnthropicAuth> = {
  id: "anthropic",
  displayName: "Anthropic Subscription",

  async fetchUsage(auth: AnthropicAuth): Promise<UsageSnapshot | null> {
    try {
      // Fetch usage and profile in parallel; profile is non-critical
      const [usage, profile] = await Promise.all([
        fetchAnthropicUsage(auth),
        fetchAnthropicProfile(auth).catch(() => null),
      ])

      const planTier = resolvePlanTier(profile)

      return {
        timestamp: Date.now(),
        provider: "anthropic",
        planType: planTier === "unknown" ? null : planTier as any,
        primary: usage.five_hour
          ? {
              usedPercent: usage.five_hour.utilization,
              windowMinutes: 300,
              resetsAt: usage.five_hour.resets_at
                ? Math.floor(new Date(usage.five_hour.resets_at).getTime() / 1000)
                : null,
            }
          : null,
        secondary: usage.seven_day
          ? {
              usedPercent: usage.seven_day.utilization,
              windowMinutes: 10080,
              resetsAt: usage.seven_day.resets_at
                ? Math.floor(new Date(usage.seven_day.resets_at).getTime() / 1000)
                : null,
            }
          : null,
        codeReview: null,
        credits: null,
        anthropicQuota: buildAnthropicQuota(usage, profile),
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  },
}
