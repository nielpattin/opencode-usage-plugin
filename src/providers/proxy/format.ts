/**
 * Display formatting utilities for proxy limits.
 * Aligned with refactored /v1/quota-stats API schema.
 */

import type { ProxyResponse, Credential, WindowStats } from "./types"

const GROUP_MAPPING: Record<string, string> = {
  "claude": "claude",
  "g3-pro": "g3-pro",
  "g3-flash": "g3-fla",
  "pro": "g3-pro",
  "3-flash": "g3-fla"
}

function formatBar(remainingPercent: number): string {
  const clamped = Math.max(0, Math.min(100, remainingPercent))
  const size = 20
  const filled = Math.round((clamped / 100) * size)
  const empty = size - filled
  return `[${"=".repeat(filled)}${".".repeat(empty)}]`
}

function formatResetTime(isoString: string | null): string {
  if (!isoString) return ""
  try {
    const resetAt = new Date(isoString).getTime() / 1000
    const now = Math.floor(Date.now() / 1000)
    const diff = resetAt - now
    if (diff <= 0) return ""
    if (diff < 60) return ` (resets in ${diff}s)`
    if (diff < 3600) return ` (resets in ${Math.ceil(diff / 60)}m)`
    if (diff < 86400) return ` (resets in ${Math.round(diff / 3600)}h)`
    return ` (resets in ${Math.round(diff / 86400)}d)`
  } catch {
    return ""
  }
}

type GroupQuota = {
  remaining: number
  max: number
  resetTime: string | null
}

/**
 * Aggregate quota from provider-level quota_groups (new schema).
 */
function aggregateProviderQuotaGroups(
  quotaGroups: Record<string, { baseline?: number; remaining: number; resets_at?: string }> | undefined,
): Map<string, GroupQuota> {
  const result = new Map<string, GroupQuota>()

  if (!quotaGroups) return result

  for (const [name, data] of Object.entries(quotaGroups)) {
    if (!(name in GROUP_MAPPING)) continue
    const mappedName = GROUP_MAPPING[name]!

    result.set(mappedName, {
      remaining: data.remaining,
      max: data.baseline ?? 0,
      resetTime: data.resets_at ?? null,
    })
  }

  return result
}

/**
 * Aggregate quota from credential-level windows (fallback).
 */
function aggregateCredentialWindows(
  credentials: Credential[],
  windowName: string = "5h",
): Map<string, GroupQuota> {
  const result = new Map<string, GroupQuota>()

  for (const cred of credentials) {
    const window = cred.windows[windowName]
    if (!window) continue

    const groupName = cred.tier || "default"
    const existing = result.get(groupName)

    if (existing) {
      existing.remaining += window.remaining
      existing.max += window.limit ?? 0
      if (window.reset_at && (!existing.resetTime || new Date(window.reset_at) > new Date(existing.resetTime))) {
        existing.resetTime = window.reset_at
      }
    } else {
      result.set(groupName, {
        remaining: window.remaining,
        max: window.limit ?? 0,
        resetTime: window.reset_at,
      })
    }
  }

  return result
}

/**
 * Format credential status as a compact string.
 */
function formatCredentialStatus(cred: Credential): string {
  const parts: string[] = []
  if (cred.on_cooldown) parts.push("cooldown")
  if (cred.exhausted) parts.push("exhausted")
  if (!cred.active) parts.push("inactive")
  return parts.length > 0 ? ` (${parts.join(", ")})` : ""
}

export function formatProxyLimits(data: ProxyResponse): string {
  const lines: string[] = []

  lines.push("[Google] Mirrowel Proxy")
  lines.push("")

  if (!data.providers || Object.keys(data.providers).length === 0) {
    lines.push("No provider data available")
    return lines.join("\n")
  }

  // Show summary
  const summary = data.summary
  lines.push(`Summary: ${summary.total_requests.toLocaleString()} requests, ${summary.total_tokens.toLocaleString()} tokens, $${summary.total_cost.toFixed(2)}`)
  lines.push("")

  for (const [providerName, provider] of Object.entries(data.providers)) {
    lines.push(`${providerName}:`)

    // Try provider-level quota_groups first
    const providerGroups = aggregateProviderQuotaGroups(provider.quota_groups)

    if (providerGroups.size > 0) {
      lines.push("  Model Groups:")
      for (const [groupName, quota] of providerGroups) {
        const remainingPct = quota.max > 0 ? (quota.remaining / quota.max) * 100 : 0
        const resetSuffix = quota.remaining === 0 ? formatResetTime(quota.resetTime) : ""
        lines.push(`    ${groupName}: ${formatBar(remainingPct)} ${quota.remaining}/${quota.max}${resetSuffix}`)
      }
    } else {
      // Fallback: show credential windows
      lines.push("  Credentials (5h window):")
      const windowData = aggregateCredentialWindows(provider.credentials, "5h")
      for (const [groupName, quota] of windowData) {
        const remainingPct = quota.max > 0 ? (quota.remaining / quota.max) * 100 : 0
        const resetSuffix = quota.remaining === 0 ? formatResetTime(quota.resetTime) : ""
        lines.push(`    ${groupName}: ${formatBar(remainingPct)} ${quota.remaining}/${quota.max}${resetSuffix}`)
      }
    }

    // Show credential count details
    const active = provider.active_count
    const total = provider.credential_count
    const cooldown = provider.on_cooldown_count
    const exhausted = provider.exhausted_count
    lines.push(`  Credentials: ${active}/${total} active`)
    if (cooldown > 0) lines.push(`    Cooldown: ${cooldown}`)
    if (exhausted > 0) lines.push(`    Exhausted: ${exhausted}`)

    // Show detailed credential list if available
    if (provider.credentials && provider.credentials.length > 0) {
      lines.push("")
      lines.push("  Detailed Status:")
      for (const cred of provider.credentials) {
        const window5h = cred.windows["5h"]
        const status = formatCredentialStatus(cred)
        const windowInfo = window5h
          ? `${window5h.remaining}/${window5h.limit ?? "∞"} requests`
          : "no data"

        lines.push(`    ${cred.display_name}${status}`)
        lines.push(`      ${windowInfo}`)
      }
    }

    lines.push("")
  }

  return lines.join("\n")
}
