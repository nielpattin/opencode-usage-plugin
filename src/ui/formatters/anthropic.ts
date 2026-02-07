import type { UsageSnapshot } from "../../types"
import { formatBar, formatResetSuffixISO } from "./shared"

function toTitleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function formatExtraUsage(snapshot: NonNullable<UsageSnapshot["anthropicQuota"]>["extraUsage"]): string[] {
  if (!snapshot?.isEnabled) return []

  const lines = [
    `  Extra Usage:   ${snapshot.utilization !== null ? `${snapshot.utilization.toFixed(0)}% used` : "enabled"}`,
  ]

  if (snapshot.usedCredits || snapshot.monthlyLimit) {
    const used = snapshot.usedCredits ?? "-"
    const limit = snapshot.monthlyLimit ?? "-"
    lines.push(`  Credits:       ${used} / ${limit}`)
  }

  return lines
}

export function formatAnthropicSnapshot(snapshot: UsageSnapshot): string[] {
  const quota = snapshot.anthropicQuota
  const plan = snapshot.planType ? ` (${toTitleCase(snapshot.planType)})` : ""
  const lines = [`→ [ANTHROPIC]${plan}`]

  if (!quota) return lines

  if (quota.subscription?.rateLimitTier) {
    lines.push(`  Tier:          ${quota.subscription.rateLimitTier}`)
  }

  for (const limit of quota.limits) {
    const leftPercent = Math.max(0, Math.min(100, 100 - limit.utilization))
    lines.push(
      `  ${`${limit.label}:`.padEnd(14)} ${formatBar(leftPercent)} ${leftPercent.toFixed(0)}% left${limit.resetsAt ? formatResetSuffixISO(limit.resetsAt) : ""}`,
    )
  }

  lines.push(...formatExtraUsage(quota.extraUsage))

  if (quota.limits.length === 0 && !quota.extraUsage?.isEnabled) {
    lines.push("  No active Anthropic usage windows returned.")
  }

  return lines
}
