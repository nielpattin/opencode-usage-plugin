/**
 * Fetch logic for OpenRouter usage monitoring.
 */

import {
  openRouterAuthResponseSchema,
  type OpenRouterAuth,
  type OpenRouterAuthResponse,
} from "./types"

export async function fetchOpenRouterUsage(auth: OpenRouterAuth): Promise<OpenRouterAuthResponse> {
  const url = "https://openrouter.ai/api/v1/key"

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${auth.key}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`OpenRouter API failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const parsed = openRouterAuthResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error("Invalid OpenRouter response structure")
  return parsed.data
}
