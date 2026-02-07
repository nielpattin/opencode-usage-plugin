/**
 * HTTP client for Anthropic subscription usage endpoints.
 * Fetches usage windows and profile data via OAuth bearer token.
 */

import type { AnthropicAuth, AnthropicUsageResponse, AnthropicProfileResponse } from "./types"

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
const PROFILE_URL = "https://api.anthropic.com/api/oauth/profile"
const BETA_HEADER = "oauth-2025-04-20"
const USER_AGENT = "claude-code/2.0.32"
const DEFAULT_TIMEOUT = 10_000

function buildHeaders(auth: AnthropicAuth): Record<string, string> {
  return {
    "Authorization": `Bearer ${auth.access}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": USER_AGENT,
    "anthropic-beta": BETA_HEADER,
  }
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeout = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchAnthropicUsage(auth: AnthropicAuth): Promise<AnthropicUsageResponse> {
  const headers = buildHeaders(auth)
  const response = await fetchWithTimeout(USAGE_URL, headers)

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Anthropic usage request failed: HTTP ${response.status}${body ? ` - ${body}` : ""}`)
  }

  return (await response.json()) as AnthropicUsageResponse
}

export async function fetchAnthropicProfile(auth: AnthropicAuth): Promise<AnthropicProfileResponse> {
  const headers = buildHeaders(auth)
  const response = await fetchWithTimeout(PROFILE_URL, headers)

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Anthropic profile request failed: HTTP ${response.status}${body ? ` - ${body}` : ""}`)
  }

  return (await response.json()) as AnthropicProfileResponse
}
