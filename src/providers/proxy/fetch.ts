/**
 * HTTP client for fetching proxy quota stats.
 */

import type { ProxyResponse } from "./types"
import type { UsageConfig } from "../../types"

export async function fetchProxyLimits(config: UsageConfig): Promise<ProxyResponse> {
  const { endpoint, apiKey, timeout = 10000 } = config

  if (!endpoint) {
    throw new Error("Proxy endpoint not configured. Set 'endpoint' in ~/.config/opencode/usage-config.jsonc\n\nDefault: http://localhost:8000\nIf you changed this during proxy setup, update your config.")
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const baseUrl = endpoint.endsWith("/v1") ? endpoint : `${endpoint}/v1`
  const url = `${baseUrl}/quota-stats`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Proxy request failed: HTTP ${response.status}. Check your usage-config.jsonc:\n\n  - Default endpoint: http://localhost:8000\n  - Default apiKey: VerysecretKey\n\nIf you changed these during proxy setup, you MUST update your config file to match.`)
    }

    return (await response.json()) as ProxyResponse
  } finally {
    clearTimeout(timeoutId)
  }
}
