/**
 * Keeps the active session context for usage notifications.
 * Stored in a mutable object so hooks can share updates.
 */

export type UsageState = {
  sessionID: string | null
  agent?: string
  model?: { providerID: string; modelID: string }
}

export function createUsageState(): UsageState {
  return { sessionID: null }
}
