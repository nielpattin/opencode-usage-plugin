/**
 * Formats various usage snapshots (Proxy, Copilot, Codex) into human-readable text.
 * Provides specialized formatting for progress bars, reset times, and missing data states.
 */

import { platform, homedir } from "os"
import { join } from "path"
import type { UsageSnapshot } from "../../types"

export function formatBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct))
  const size = 15
  const filled = Math.round((clamped / 100) * size)
  return `${"█".repeat(filled)}${"░".repeat(size - filled)}`
}

export function formatResetSuffix(resetAt: number | null): string {
  if (!resetAt) return ""
  return ` (resets in ${formatTimeDelta(resetAt)})`
}

export function formatResetSuffixISO(iso: string): string {
  try {
    const at = Math.floor(new Date(iso).getTime() / 1000)
    return ` (resets in ${formatTimeDelta(at)})`
  } catch { return "" }
}

function formatTimeDelta(at: number): string {
  const atSeconds = at > 1e11 ? Math.floor(at / 1000) : at
  
  const diff = atSeconds - Math.floor(Date.now() / 1000)
  if (diff <= 0) return "now"
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`
  if (diff < 86400) return `${Math.round(diff / 3600)}h`
  return `${Math.round(diff / 86400)}d`
}

export function formatMissingSnapshot(snapshot: UsageSnapshot): string[] {
  const { provider } = snapshot
  const order =
    typeof snapshot.accountOrder === "number"
      ? ` [#${snapshot.accountOrder}${typeof snapshot.accountTotal === "number" ? `/${snapshot.accountTotal}` : ""}]`
      : ""
  const account = snapshot.accountLabel ? ` [${snapshot.accountLabel}]` : ""
  const configPath = getConfigPath()
  const instructions: Record<string, string> = {
    codex: "if you dont have codex oauth, please set your usage-config.jsonc to openai: false",
    proxy: "check your usage-config.jsonc. Default: endpoint http://localhost:8000, apiKey VerysecretKey. If you changed these during proxy setup, update your config to match. Or set proxy: false to disable.",
    copilot: "if you are not running GitHub Copilot, please set your usage-config.jsonc to copilot: false"
  }

  const lines = [`→ [${provider.toUpperCase()}]${order}${account} - ${instructions[provider] || ""}`]
  if (snapshot.missingReason) lines.push("", `Reason: ${snapshot.missingReason}`)
  if (snapshot.missingDetails?.length) {
    lines.push("", "Details:", ...snapshot.missingDetails.map((d: string) => `- ${d}`))
  }

  return [...lines, "", `File: ${configPath}`, "", "Issue? https://github.com/IgorWarzocha/opencode-usage-plugin/issues"]
}

function getConfigPath() {
  const home = homedir()
  // Use ~/.config/opencode/usage-config.jsonc on all platforms
  const configHome = process.env.XDG_CONFIG_HOME || join(home, ".config")
  return join(configHome, "opencode", "usage-config.jsonc")
}
