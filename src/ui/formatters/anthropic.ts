/**
 * Formats Anthropic subscription usage snapshots.
 * Handles all plan tiers: Free, Pro, Max, Team, Enterprise.
 * Displays 5h session, 7d weekly, model-specific, and extra usage windows.
 */

import type { UsageSnapshot, AnthropicQuota, AnthropicUsageWindow } from "../../types"
import { formatBar, formatResetSuffixISO, formatMissingSnapshot } from "./shared"

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro ($20/mo)",
  max: "Max",
  team: "Team",
  enterprise: "Enterprise",
  unknown: "Unknown Plan",
}

interface WindowDisplay {
  label: string
  window: AnthropicUsageWindow
}

function collectWindows(quota: AnthropicQuota): WindowDisplay[] {
  const windows: WindowDisplay[] = []

  if (quota.fiveHour) windows.push({ label: "5h Session", window: quota.fiveHour })
  if (quota.sevenDay) windows.push({ label: "7d Weekly", window: quota.sevenDay })
  if (quota.sevenDayOpus) windows.push({ label: "7d Opus", window: quota.sevenDayOpus })
  if (quota.sevenDaySonnet) windows.push({ label: "7d Sonnet", window: quota.sevenDaySonnet })
  if (quota.sevenDayCowork) windows.push({ label: "7d Cowork", window: quota.sevenDayCowork })
  if (quota.sevenDayOAuthApps) windows.push({ label: "7d OAuth", window: quota.sevenDayOAuthApps })
  if (quota.iguanaNecktie) windows.push({ label: "Burst", window: quota.iguanaNecktie })

  return windows
}

function formatWindow(label: string, window: AnthropicUsageWindow, labelWidth: number): string {
  const pct = Math.max(0, 100 - window.utilization)
  const reset = window.resetsAt ? formatResetSuffixISO(window.resetsAt) : ""
  return `  ${(label + ":").padEnd(labelWidth + 1)} ${formatBar(pct)} ${pct.toFixed(0)}% left${reset}`
}

export function formatAnthropicSnapshot(snapshot: UsageSnapshot): string[] {
  const quota = snapshot.anthropicQuota
  if (!quota) return formatMissingSnapshot(snapshot)

  const planLabel = PLAN_LABELS[quota.planTier] ?? quota.planTier
  const status = quota.subscriptionStatus && quota.subscriptionStatus !== "active"
    ? ` [${quota.subscriptionStatus}]`
    : ""
  const lines = [`→ [ANTHROPIC] Claude Code - ${planLabel}${status}`]

  const windows = collectWindows(quota)
  if (windows.length === 0 && !quota.extraUsage?.isEnabled) {
    return formatMissingSnapshot(snapshot)
  }

  const labelWidth = Math.max(...windows.map(w => w.label.length), 10)
  for (const { label, window } of windows) {
    lines.push(formatWindow(label, window, labelWidth))
  }

  if (quota.extraUsage) {
    lines.push("")
    if (quota.extraUsage.isEnabled) {
      const used = quota.extraUsage.usedCredits != null ? `$${quota.extraUsage.usedCredits.toFixed(2)}` : "N/A"
      const limit = quota.extraUsage.monthlyLimit != null ? `$${quota.extraUsage.monthlyLimit.toFixed(2)}` : "no limit"
      const pct = quota.extraUsage.utilization != null ? `${(100 - quota.extraUsage.utilization).toFixed(0)}% left` : ""
      lines.push(`  Extra Usage:  ON  (${used} / ${limit})${pct ? ` ${pct}` : ""}`)
    } else {
      lines.push(`  Extra Usage:  OFF`)
    }
  }

  return lines
}
