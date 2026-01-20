/**
 * Copilot usage fetchers for internal GitHub endpoints.
 * Separate from parsing to keep response handling focused.
 */

import type { CopilotUserResponse, CopilotV2TokenResponse } from "./types"
import { copilotTokenSchema, copilotUserSchema } from "./types"

export async function fetchFromV2Token(accessToken: string): Promise<CopilotV2TokenResponse | null> {
  const response = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "GitHubCopilot/1.155.0",
      Accept: "application/json",
      "Editor-Version": "vscode/1.85.0",
      "Editor-Plugin-Version": "copilot/1.155.0",
    },
  }).catch(() => null)

  if (!response?.ok) return null
  const data = await response.json().catch(() => null)
  if (!data) return null
  const parsed = copilotTokenSchema.safeParse(data)
  if (!parsed.success) return null
  return parsed.data
}

export async function fetchFromUser(accessToken: string): Promise<CopilotUserResponse | null> {
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
      "User-Agent": "GitHubCopilotChat/0.26.7",
      "X-Github-Api-Version": "2025-04-01",
    },
  }).catch(() => null)

  if (!response?.ok) return null
  const data = await response.json().catch(() => null)
  if (!data) return null
  const parsed = copilotUserSchema.safeParse(data)
  if (!parsed.success) return null
  return parsed.data
}
