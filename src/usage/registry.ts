/**
 * Resolves provider auth entries for usage snapshots.
 */

import type { CodexAuth } from "../providers/codex"
import type { CopilotAuthData } from "../providers/copilot/types"
import type { ZaiAuth } from "../providers/zai/types"

export type AuthEntry = {
  type?: string
  access?: string
  refresh?: string
  enterpriseUrl?: string
  accountId?: string
  key?: string
}

export type AuthRecord = Record<string, AuthEntry>

type ProviderAuthEntry =
  | { providerID: "codex"; auth: CodexAuth }
  | { providerID: "copilot"; auth: CopilotAuthData }
  | { providerID: "zai-coding-plan"; auth: ZaiAuth }

export type AuthResolutionOptions = {
  allOpenAIAccounts?: boolean
}

type ProviderDescriptor = {
  id: ProviderAuthEntry["providerID"]
  authKeys: string[]
  requiresOAuth: boolean
  buildAuth: (entry: AuthEntry, key: string, usageToken: string | null) => ProviderAuthEntry["auth"]
}

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: "codex",
    authKeys: ["codex", "openai"],
    requiresOAuth: true,
    buildAuth: (entry, key) => ({
      access: entry.access || entry.key,
      accountId: entry.accountId,
      accountLabel: key || undefined,
    }),
  },
  {
    id: "copilot",
    authKeys: ["copilot", "github-copilot"],
    requiresOAuth: true,
    buildAuth: (entry) => ({
      access: entry.access,
      refresh: entry.refresh,
    }),
  },
  {
    id: "zai-coding-plan",
    authKeys: ["zai-coding-plan", "zai", "glm"],
    requiresOAuth: false,
    buildAuth: (entry) => ({
      key: entry.key || entry.access || "",
    }),
  },
]

const CODEX_RESERVED_LABELS = new Set([
  "codex",
  "openai",
  "copilot",
  "github-copilot",
  "zai-coding-plan",
  "zai",
  "glm",
  "proxy",
])

const CODEX_FALLBACK_LABELS = new Set(["codex", "openai"])

function isCodexOAuthEntry(entry: AuthEntry | undefined): boolean {
  if (!entry) return false
  if (entry.type && entry.type !== "oauth" && entry.type !== "token") return false
  return Boolean(entry.access || entry.key || entry.refresh)
}

function resolveCodexAuthPairs(auths: AuthRecord, allOpenAIAccounts: boolean): Array<[string, AuthEntry]> {
  if (!allOpenAIAccounts) {
    const single = ["codex", "openai"].find((key) => Boolean(auths[key]))
    return single && auths[single] ? [["", auths[single]]] : []
  }

  const accountKeys = Object.keys(auths).filter((key) => !CODEX_RESERVED_LABELS.has(key) && isCodexOAuthEntry(auths[key]))
  const fallbackKeys = ["codex", "openai"].filter((key) => Boolean(auths[key]))
  const orderedKeys = [...accountKeys, ...fallbackKeys]

  const pairsByIdentity = new Map<string, [string, AuthEntry]>()

  for (const key of orderedKeys) {
    const entry = auths[key]
    if (!entry) continue

    const hasIdentityFields = Boolean(entry.accountId || entry.access || entry.key)
    const identity = hasIdentityFields
      ? `${entry.accountId || ""}|${entry.access || entry.key || ""}`
      : `key:${key}`

    const existing = pairsByIdentity.get(identity)
    if (!existing) {
      pairsByIdentity.set(identity, [key, entry])
      continue
    }

    const isExistingAccount = !CODEX_FALLBACK_LABELS.has(existing[0])
    const isCurrentAccount = !CODEX_FALLBACK_LABELS.has(key)
    if (!isExistingAccount && isCurrentAccount) {
      pairsByIdentity.set(identity, [key, entry])
    }
  }

  return Array.from(pairsByIdentity.values())
}

function resolveAuthPairs(
  auths: AuthRecord,
  descriptor: ProviderDescriptor,
  options: AuthResolutionOptions,
): Array<[string, AuthEntry]> {
  if (descriptor.id === "codex") {
    return resolveCodexAuthPairs(auths, options.allOpenAIAccounts === true)
  }

  const matched = descriptor.authKeys.find((key) => Boolean(auths[key]))
  if (!matched || !auths[matched]) return []
  return [[matched, auths[matched]]]
}

export function resolveProviderAuths(
  auths: AuthRecord,
  usageToken: string | null,
  options: AuthResolutionOptions = {},
): ProviderAuthEntry[] {
  const entries: ProviderAuthEntry[] = []

  for (const descriptor of providerDescriptors) {
    const pairs = resolveAuthPairs(auths, descriptor, options)
    if (pairs.length === 0) continue

    for (const [key, auth] of pairs) {
      if (descriptor.requiresOAuth && auth.type && auth.type !== "oauth" && auth.type !== "token") continue
      const built = descriptor.buildAuth(auth, key, usageToken)
      if (descriptor.id === "codex" && !(built as CodexAuth).access) continue
      entries.push({ providerID: descriptor.id, auth: built } as ProviderAuthEntry)
    }
  }

  return entries
}
