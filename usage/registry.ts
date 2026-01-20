/**
 * Resolves provider auth entries for usage snapshots.
 * Centralizes provider auth mapping for extensibility.
 */

import type { CopilotAuth } from "../providers/copilot/types"
import type { CodexAuth } from "../providers/codex"

export type AuthEntry = {
  type?: string
  access?: string
  refresh?: string
  enterpriseUrl?: string
  accountId?: string
}

export type AuthRecord = Record<string, AuthEntry>

type ProviderAuthEntry =
  | { providerID: "github-copilot"; auth: CopilotAuth }
  | { providerID: "codex"; auth: CodexAuth }

type ProviderDescriptor = {
  id: ProviderAuthEntry["providerID"]
  authKeys: string[]
  requiresOAuth: boolean
  buildAuth: (entry: AuthEntry, usageToken: string | null) => ProviderAuthEntry["auth"]
}

const providerDescriptors: ProviderDescriptor[] = [
  {
    id: "github-copilot",
    authKeys: ["github-copilot", "github-copilot-enterprise", "copilot"],
    requiresOAuth: true,
    buildAuth: (entry, usageToken) => ({
      access: entry.access,
      refresh: entry.refresh,
      usageToken: usageToken ?? undefined,
    }),
  },
  {
    id: "codex",
    authKeys: ["codex", "openai"],
    requiresOAuth: true,
    buildAuth: (entry) => ({
      access: entry.access,
      accountId: entry.accountId,
    }),
  },
]

export function resolveProviderAuths(auths: AuthRecord, usageToken: string | null): ProviderAuthEntry[] {
  const entries: ProviderAuthEntry[] = []

  for (const descriptor of providerDescriptors) {
    const matched = descriptor.authKeys.find((key) => Boolean(auths[key]))
    if (!matched) continue
    const auth = auths[matched]
    if (!auth) continue
    if (descriptor.requiresOAuth && auth.type && auth.type !== "oauth") continue
    const built = descriptor.buildAuth(auth, usageToken)
    entries.push({ providerID: descriptor.id, auth: built } as ProviderAuthEntry)
  }

  return entries
}
