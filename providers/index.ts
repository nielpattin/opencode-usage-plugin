/**
 * Barrel exports for usage providers.
 * Centralizes provider registration for fetchers.
 */

import type { UsageProvider } from "./base"
import { CodexProvider } from "./codex"

export const providers: Record<string, UsageProvider<unknown>> = {
  [CodexProvider.id]: CodexProvider as UsageProvider<unknown>,
}

export { CodexProvider } from "./codex"
export type { UsageProvider } from "./base"

