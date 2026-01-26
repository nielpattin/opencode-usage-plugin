/**
 * providers/copilot/enterprise.ts
 * GitHub Copilot Enterprise and Organization metrics provider.
 * Fetches usage data from the public preview Copilot usage metrics API.
 *
 * NOTE: This feature is in public preview with data protection and subject to change.
 * Requires "Copilot usage metrics" policy to be set to "Enabled everywhere" for the enterprise.
 *
 * @see https://docs.github.com/rest/copilot/copilot-usage-metrics
 */

import type { CopilotQuota } from "../../types.js"

const GITHUB_API_BASE_URL = "https://api.github.com"
const API_VERSION = "2022-11-28"

interface EnterpriseMetricsResponse {
  download_links: string[]
  report_start_day: string
  report_end_day: string
}

interface OrganizationMetricsResponse {
  download_links: string[]
  report_start_day: string
  report_end_day: string
}

interface EnterpriseMetricsEntry {
  /** Enterprise slug */
  enterprise_id: string
  /** Date in YYYY-MM-DD format */
  date: string
  /** Total number of active users */
  total_active_users: number
  /** Total number of engaged users */
  total_engaged_users: number
  /** Total lines of code suggested */
  total_lines_suggested: number
  /** Total lines of code accepted */
  total_lines_accepted: number
  /** Number of code suggestions */
  total_suggestions_count: number
  /** Number of accepted suggestions */
  total_acceptances_count: number
  /** Number of completions */
  completions_count: number
  /** Number of chat conversations */
  chat_conversations_count: number
  /** Number of chat acceptances */
  chat_acceptances_count: number
  /** Number of premium interactions */
  premium_interactions_count?: number
  /** Total number of premium requests */
  total_premium_requests?: number
}

interface OrganizationMetricsEntry {
  /** Organization ID */
  organization_id: string
  /** Date in YYYY-MM-DD format */
  date: string
  /** Total number of active users */
  total_active_users: number
  /** Total number of engaged users */
  total_engaged_users: number
  /** Total lines of code suggested */
  total_lines_suggested: number
  /** Total lines of code accepted */
  total_lines_accepted: number
  /** Number of code suggestions */
  total_suggestions_count: number
  /** Number of accepted suggestions */
  total_acceptances_count: number
  /** Number of completions */
  completions_count: number
  /** Number of chat conversations */
  chat_conversations_count: number
  /** Number of chat acceptances */
  chat_acceptances_count: number
  /** Number of premium interactions */
  premium_interactions_count?: number
  /** Total number of premium requests */
  total_premium_requests?: number
}

const REQUEST_TIMEOUT_MS = 10000

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch and parse the latest 28-day enterprise metrics report.
 * Aggregates data across all days to compute total usage.
 */
async function fetchEnterpriseMetrics(
  enterprise: string,
  authToken: string,
): Promise<EnterpriseMetricsEntry[] | null> {
  const url = `${GITHUB_API_BASE_URL}/enterprises/${enterprise}/copilot/metrics/reports/enterprise-28-day/latest`

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${authToken}`,
          "X-GitHub-Api-Version": API_VERSION,
        },
      },
      REQUEST_TIMEOUT_MS,
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as EnterpriseMetricsResponse

    // Fetch the first report link (NDJSON format)
    if (!data.download_links || data.download_links.length === 0) {
      return null
    }

    const reportUrl = data.download_links[0]
    const reportResponse = await fetchWithTimeout(reportUrl, {}, REQUEST_TIMEOUT_MS)

    if (!reportResponse.ok) {
      return null
    }

    const reportText = await reportResponse.text()
    const lines = reportText.trim().split("\n")

    return lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as EnterpriseMetricsEntry
        } catch {
          return null
        }
      })
      .filter((entry): entry is EnterpriseMetricsEntry => entry !== null)
  } catch {
    return null
  }
}

/**
 * Fetch and parse the latest 28-day organization metrics report.
 * Aggregates data across all days to compute total usage.
 */
async function fetchOrganizationMetrics(
  organization: string,
  authToken: string,
): Promise<OrganizationMetricsEntry[] | null> {
  const url = `${GITHUB_API_BASE_URL}/orgs/${organization}/copilot/metrics/reports/organization-28-day/latest`

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${authToken}`,
          "X-GitHub-Api-Version": API_VERSION,
        },
      },
      REQUEST_TIMEOUT_MS,
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as OrganizationMetricsResponse

    // Fetch the first report link (NDJSON format)
    if (!data.download_links || data.download_links.length === 0) {
      return null
    }

    const reportUrl = data.download_links[0]
    const reportResponse = await fetchWithTimeout(reportUrl, {}, REQUEST_TIMEOUT_MS)

    if (!reportResponse.ok) {
      return null
    }

    const reportText = await reportResponse.text()
    const lines = reportText.trim().split("\n")

    return lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as OrganizationMetricsEntry
        } catch {
          return null
        }
      })
      .filter((entry): entry is OrganizationMetricsEntry => entry !== null)
  } catch {
    return null
  }
}

/**
 * Convert enterprise/org metrics to CopilotQuota format.
 * Aggregates premium requests across the 28-day period.
 *
 * Note: This is an approximation. The enterprise metrics API provides
 * historical aggregate data, not real-time quota remaining.
 */
function toCopilotQuotaFromMetrics(
  entries: (EnterpriseMetricsEntry | OrganizationMetricsEntry)[],
): CopilotQuota | null {
  if (entries.length === 0) {
    return null
  }

  // Aggregate total premium requests across all days
  const totalPremiumRequests = entries.reduce((sum, entry) => {
    return sum + (entry.total_premium_requests || entry.premium_interactions_count || 0)
  }, 0)

  // Get the most recent date for reset time calculation
  const mostRecentEntry = entries[entries.length - 1]
  const lastDay = new Date(mostRecentEntry.date)

  // Estimate monthly reset (1st of next month)
  const resetTime = new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, 1)).toISOString()

  // For enterprise, we don't have a clear "total quota" from the metrics API
  // We use -1 to indicate unlimited/unknown quota
  return {
    used: totalPremiumRequests,
    total: -1, // Enterprise quotas are managed at the org level
    percentRemaining: 0, // Cannot determine without quota info
    resetTime,
    completionsUsed: entries.reduce((sum, e) => sum + (e.completions_count || 0), 0),
    completionsTotal: -1,
  }
}

/**
 * Configuration for fetching enterprise/org metrics.
 */
export interface CopilotEnterpriseAuth {
  /** Enterprise slug for enterprise-level metrics */
  enterprise?: string
  /** Organization name for org-level metrics */
  organization?: string
  /** Auth token with appropriate scopes */
  token: string
}

/**
 * Fetch usage data from GitHub Copilot enterprise/organization metrics API.
 *
 * Requires:
 * - "Copilot usage metrics" policy enabled for the enterprise
 * - Token with "View Enterprise Copilot Metrics" or "View Organization Copilot Metrics" permission
 * - For fine-grained PATs: "Enterprise Copilot metrics" (read) or "Organization Copilot metrics" (read)
 * - For classic PATs: `manage_billing:copilot` or `read:enterprise` / `read:org`
 */
export async function fetchCopilotEnterpriseUsage(
  auth: CopilotEnterpriseAuth,
): Promise<CopilotQuota | null> {
  const { enterprise, organization, token } = auth

  if (!enterprise && !organization) {
    return null
  }

  let metrics: (EnterpriseMetricsEntry | OrganizationMetricsEntry)[] | null = null

  // Try enterprise endpoint first
  if (enterprise) {
    metrics = await fetchEnterpriseMetrics(enterprise, token)
  }

  // Fall back to organization endpoint if enterprise fails
  if (!metrics && organization) {
    metrics = await fetchOrganizationMetrics(organization, token)
  }

  if (!metrics || metrics.length === 0) {
    return null
  }

  return toCopilotQuotaFromMetrics(metrics)
}
