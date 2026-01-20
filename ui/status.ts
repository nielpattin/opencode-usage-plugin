/**
 * Renders usage snapshots into readable status text.
 * Handles delivery via session prompt with a toast fallback.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { UsageSnapshot } from "../types"
import type { UsageState } from "../state"

type UsageClient = PluginInput["client"]

export async function sendStatusMessage(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  text: string
}): Promise<void> {
  const sent = await options.client.session
    .prompt({
      path: { id: options.sessionID },
      body: {
        noReply: true,
        agent: options.state.agent,
        model: options.state.model,
        parts: [{ type: "text", text: options.text, ignored: true }],
      },
    })
    .then(() => true)
    .catch(() => false)

  if (sent) return

  await options.client.tui
    .showToast({
      body: { title: "Usage Status", message: options.text, variant: "info" },
    })
    .catch(() => {})
}

export async function renderUsageStatus(options: {
  client: UsageClient
  state: UsageState
  sessionID: string
  snapshots: UsageSnapshot[]
}): Promise<void> {
  if (options.snapshots.length === 0) {
    await sendStatusMessage({
      client: options.client,
      state: options.state,
      sessionID: options.sessionID,
      text: "▣ Usage | No data received from providers.",
    })
    return
  }

  const lines: string[] = ["▣ Usage Status", ""]

  options.snapshots.forEach((snapshot, index) => {
    const snapshotLines = formatSnapshot(snapshot)
    for (const line of snapshotLines) lines.push(line)
    if (index < options.snapshots.length - 1) {
      lines.push("")
    }
  })

  await sendStatusMessage({
    client: options.client,
    state: options.state,
    sessionID: options.sessionID,
    text: lines.join("\n"),
  })
}

function formatSnapshot(snapshot: UsageSnapshot): string[] {
  const plan = snapshot.planType ? ` (${formatPlanType(snapshot.planType)})` : ""
  const base = `→ [${snapshot.provider}]${plan}`
  const lines: string[] = [base]

  if (snapshot.provider === "github-copilot" && snapshot.quota) {
    const quota = snapshot.quota
    const primary = snapshot.primary
    const secondary = snapshot.secondary

    if (primary) {
      lines.push(`   Chat Usage  ${formatBar(primary.usedPercent)} ${primary.usedPercent.toFixed(0)}% used`)
    }
    if (secondary) {
      lines.push(`   Completion  ${formatBar(secondary.usedPercent)} ${secondary.usedPercent.toFixed(0)}% used`)
    }
    if (quota.chat !== null) {
      lines.push(`   Chat Limit: ${quota.chat}/month`)
    }
    if (quota.completions !== null) {
      lines.push(`   Completions Limit: ${quota.completions}/month`)
    }
    if (quota.resetAt) {
      lines.push(`   Resets in ${formatResetTime(quota.resetAt)}`)
    }

    if (lines.length === 1) {
      lines.push("   No quota info available")
    }

    return lines
  }

  const primary = snapshot.primary
  if (primary) {
    lines.push(
      `   Hourly       ${formatBar(primary.usedPercent)} ${primary.usedPercent.toFixed(0)}% used${formatResetSuffix(primary.resetsAt)}`,
    )
  }
  const secondary = snapshot.secondary
  if (secondary) {
    lines.push(
      `   Weekly       ${formatBar(secondary.usedPercent)} ${secondary.usedPercent.toFixed(0)}% used${formatResetSuffix(secondary.resetsAt)}`,
    )
  }
  const codeReview = snapshot.codeReview
  if (codeReview) {
    lines.push(
      `   Code Review  ${formatBar(codeReview.usedPercent)} ${codeReview.usedPercent.toFixed(0)}% used${formatResetSuffix(codeReview.resetsAt)}`,
    )
  }
  if (snapshot.credits?.hasCredits) {
    lines.push(`   Credits: ${snapshot.credits.balance}`)
  }

  return lines
}

function formatResetTime(resetAt: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = resetAt - now
  if (diff <= 0) return "now"
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`
  if (diff < 86400) return `${Math.round(diff / 3600)}h`
  return `${Math.round(diff / 86400)}d`
}

function formatResetSuffix(resetAt: number | null): string {
  if (!resetAt) return ""
  return ` (resets in ${formatResetTime(resetAt)})`
}

function formatBar(usedPercent: number): string {
  const clamped = Math.max(0, Math.min(100, usedPercent))
  const size = 20
  const filled = Math.round((clamped / 100) * size)
  const empty = size - filled
  return `[${"=".repeat(filled)}${".".repeat(empty)}]`
}

function formatPlanType(planType: string): string {
  return planType
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
