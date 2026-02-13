/**
 * Orchestrates the fetching of usage snapshots from multiple providers.
 * Manages provider filtering, concurrency, and fallback for missing data.
 */

import type { UsageSnapshot } from "../types"
import { providers } from "../providers"
import { loadUsageConfig } from "./config"
import { loadMergedAuths } from "./auth/loader"
import { resolveProviderAuths } from "./registry"

const CORE_PROVIDERS = ["codex", "proxy", "copilot", "zai-coding-plan"]

export type FetchUsageOptions = {
  allOpenAIAccounts?: boolean
}

export async function fetchUsageSnapshots(filter?: string, options: FetchUsageOptions = {}): Promise<UsageSnapshot[]> {
  const target = resolveFilter(filter)
  const config = await loadUsageConfig().catch(() => null)
  const toggles = config?.providers ?? {}
  const requestTimeoutMs = resolveRequestTimeout(config?.timeout)
  
  const isEnabled = (id: string) => {
    if (id === "codex") return toggles.openai !== false
    if (id === "zai-coding-plan") return toggles.zai !== false
    return (toggles as Record<string, boolean>)[id] !== false
  }

  const { auths, codexDiagnostics } = await loadMergedAuths()
  const entries = resolveProviderAuths(auths, null, {
    allOpenAIAccounts: options.allOpenAIAccounts === true,
  })

  const resolvedEntries = entries.filter((e) => (!target || e.providerID === target) && isEnabled(e.providerID))
  const resolvedProviders = new Set<string>(resolvedEntries.map((entry) => entry.providerID))
  const snapshots: UsageSnapshot[] = []
  const fetched = new Set<string>()

  const entryResults = await Promise.all(
    resolvedEntries.map(async (entry) => {
      const task = providers[entry.providerID]?.fetchUsage?.(entry.auth) ?? Promise.resolve(null)
      const snap = await withTimeout(task, requestTimeoutMs).catch(() => null)
      return { providerID: entry.providerID, snap }
    }),
  )

  for (const result of entryResults) {
    if (!result.snap) continue
    snapshots.push(result.snap)
    fetched.add(result.providerID)
  }

  const fetches: Array<Promise<void>> = []

  // Handle special/default fetches
  for (const id of ["proxy", "copilot"]) {
    if ((!target || target === id) && isEnabled(id) && !resolvedProviders.has(id)) {
      const provider = providers[id]
      if (provider?.fetchUsage) {
        fetches.push(withTimeout(provider.fetchUsage(undefined), requestTimeoutMs).then(s => {
          if (s) { 
            snapshots.push(s)
            fetched.add(id) 
          }
        }).catch(() => {}))
      }
    }
  }

  await Promise.all(fetches)
  return appendMissingStates(snapshots, fetched, isEnabled, target, codexDiagnostics)
}

function resolveRequestTimeout(configTimeout: number | undefined): number {
  if (typeof configTimeout === "number" && Number.isFinite(configTimeout) && configTimeout > 0) {
    return Math.min(Math.max(configTimeout, 3000), 60000)
  }
  return 12000
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  return Promise.race([promise, timeout])
}

function resolveFilter(f?: string): string | undefined {
  const aliases: Record<string, string> = { 
    codex: "codex", openai: "codex", gpt: "codex", 
    codexs: "codex",
    proxy: "proxy", agy: "proxy", gemini: "proxy",
    copilot: "copilot", github: "copilot",
    zai: "zai-coding-plan", glm: "zai-coding-plan"
  }
  return f ? aliases[f.toLowerCase().trim()] : undefined
}

export function resolveProviderFilter(filter?: string): string | undefined {
  return resolveFilter(filter)
}


function appendMissingStates(
  snaps: UsageSnapshot[], 
  fetched: Set<string>, 
  isEnabled: (id: string) => boolean,
  target?: string,
  diagnostics?: string[]
): UsageSnapshot[] {
  for (const id of CORE_PROVIDERS) {
    if (isEnabled(id) && !fetched.has(id) && (!target || target === id)) {
      snaps.push({
        timestamp: Date.now(),
        provider: id,
        planType: null,
        primary: null,
        secondary: null,
        codeReview: null,
        credits: null,
        updatedAt: Date.now(),
        isMissing: true,
        missingReason:
          id === "codex" ? "Usage request failed (missing auth, expired token, or unavailable endpoint)" : undefined,
        missingDetails: id === "codex" ? diagnostics : undefined
      })
    }
  }
  return snaps
}

export async function loadAuths() {
  const { auths } = await loadMergedAuths()
  return auths
}
