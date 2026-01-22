/**
 * Antigravity Proxy provider for usage tracking.
 * Fetches quota stats from a local/remote proxy server.
 * Aligned with refactored /v1/quota-stats API schema.
 */

import type { UsageProvider } from "../base"
import type { UsageSnapshot, ProxyQuota, ProxyProviderInfo, ProxyQuotaGroup, ProxyTierInfo } from "../../types"
import { loadProxyConfig } from "./config"
import { fetchProxyLimits } from "./fetch"
import type { ProxyResponse, Provider, Credential, WindowStats } from "./types"

export type { ProxyConfig, ProxyResponse } from "./types"
export { loadProxyConfig } from "./config"
export { fetchProxyLimits } from "./fetch"
export { formatProxyLimits } from "./format"

const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",
  "3-flash": "g3-fla"
}

function normalizeTier(tier?: string): "paid" | "free" {
  if (!tier) return "free"
  return tier.includes("free") ? "free" : "paid"
}

/**
 * Parse quota groups from provider-level quota_groups field.
 * This is the new way Antigravity exposes model quotas.
 */
function parseQuotaGroupsFromProvider(
  quotaGroups: Record<string, { baseline?: number; remaining: number; resets_at?: string }> | undefined,
): ProxyQuotaGroup[] {
  if (!quotaGroups) return []
  return Object.entries(quotaGroups)
    .filter(([name]) => name in GROUP_MAPPING)
    .map(([name, data]) => {
      const mappedName = GROUP_MAPPING[name]!
      const max = data.baseline ?? 0
      const remainingPct = max > 0 ? Math.round((data.remaining / max) * 100) : 0

      return {
        name: mappedName,
        remaining: data.remaining,
        max,
        remainingPct,
        resetTime: data.resets_at ?? null,
      }
    })
}

/**
 * Fallback: Parse quota groups from credential-level windows.
 * Used for providers that don't have provider-level quota_groups.
 */
function parseQuotaGroupsFromCredentials(
  credentials: Credential[],
  defaultWindow: string = "5h",
): ProxyQuotaGroup[] {
  // Group windows by model name (inferred from window structure)
  // For now, aggregate across all credentials per model group
  const groupMap = new Map<string, { remaining: number; max: number; resetTime: string | null }>()

  for (const cred of credentials) {
    for (const [windowName, window] of Object.entries(cred.windows)) {
      if (windowName !== defaultWindow) continue

      // Use credential tier as a proxy for model group
      const groupName = cred.tier || "default"
      const existing = groupMap.get(groupName)

      if (existing) {
        existing.remaining += window.remaining
        existing.max += window.limit ?? 0
        if (window.reset_at && (!existing.resetTime || new Date(window.reset_at) > new Date(existing.resetTime))) {
          existing.resetTime = window.reset_at
        }
      } else {
        groupMap.set(groupName, {
          remaining: window.remaining,
          max: window.limit ?? 0,
          resetTime: window.reset_at,
        })
      }
    }
  }

  return Array.from(groupMap.entries()).map(([name, data]) => ({
    name: name,
    remaining: data.remaining,
    max: data.max,
    remainingPct: data.max > 0 ? Math.round((data.remaining / data.max) * 100) : 0,
    resetTime: data.resetTime,
  }))
}

function aggregateByTier(provider: Provider): ProxyTierInfo[] {
  const tiers: Record<"paid" | "free", Map<string, ProxyQuotaGroup>> = {
    paid: new Map(),
    free: new Map(),
  }

  // Try provider-level quota_groups first (new schema)
  const providerGroups = parseQuotaGroupsFromProvider(provider.quota_groups)
  if (providerGroups.length > 0) {
    for (const group of providerGroups) {
      // Distribute to all tiers for provider-level quotas
      for (const tierKey of ["paid", "free"] as const) {
        tiers[tierKey].set(group.name, { ...group })
      }
    }
  } else {
    // Fallback: aggregate from credential windows
    const credGroups = parseQuotaGroupsFromCredentials(provider.credentials)
    for (const group of credGroups) {
      // Infer tier from group name or distribute
      const tierKey = "free"
      tiers[tierKey].set(group.name, { ...group })
    }
  }

  // Also aggregate by credential tiers for traditional providers
  for (const cred of provider.credentials) {
    const tier = normalizeTier(cred.tier)

    // Summarize window data per credential
    for (const [windowName, window] of Object.entries(cred.windows)) {
      if (windowName !== "5h") continue // Focus on primary window

      const groupName = `${cred.tier || "default"}-${windowName}`
      const existing = tiers[tier].get(groupName)

      if (existing) {
        existing.remaining += window.remaining
        existing.max += window.limit ?? 0
      } else {
        tiers[tier].set(groupName, {
          name: groupName,
          remaining: window.remaining,
          max: window.limit ?? 0,
          remainingPct: window.limit && window.limit > 0
            ? Math.round((window.remaining / window.limit) * 100)
            : 0,
          resetTime: window.reset_at,
        })
      }
    }
  }

  // Recalculate percentages
  for (const tierGroups of Object.values(tiers)) {
    for (const group of tierGroups.values()) {
      group.remainingPct = group.max > 0 ? Math.round((group.remaining / group.max) * 100) : 0
    }
  }

  const result: ProxyTierInfo[] = []
  if (tiers.paid.size > 0) {
    result.push({ tier: "paid", quotaGroups: Array.from(tiers.paid.values()) })
  }
  if (tiers.free.size > 0) {
    result.push({ tier: "free", quotaGroups: Array.from(tiers.free.values()) })
  }
  return result
}

function parseProviders(data: ProxyResponse): ProxyProviderInfo[] {
  if (!data.providers) return []
  return Object.entries(data.providers).map(([name, provider]) => ({
    name,
    tiers: aggregateByTier(provider),
  }))
}

function parseProxyQuota(data: ProxyResponse): ProxyQuota {
  // Count total credentials and active ones
  let totalCredentials = 0
  let activeCredentials = 0

  for (const provider of Object.values(data.providers)) {
    totalCredentials += provider.credential_count
    activeCredentials += provider.active_count
  }

  return {
    providers: parseProviders(data),
    totalCredentials,
    activeCredentials,
    dataSource: data.data_source,
  }
}

export const ProxyProvider: UsageProvider = {
  id: "proxy",
  displayName: "Mirrowel Proxy",

  async fetchUsage(): Promise<UsageSnapshot | null> {
    try {
      const config = await loadProxyConfig()
      const data = await fetchProxyLimits(config)

      return {
        timestamp: data.timestamp * 1000,
        provider: "proxy",
        planType: null,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        proxyQuota: parseProxyQuota(data),
        updatedAt: Date.now(),
      }
    } catch {
      return null
    }
  },
}
