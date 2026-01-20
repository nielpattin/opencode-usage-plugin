/**
 * GitHub Copilot usage provider backed by token metadata and GH APIs.
 * Mirrors core usage parsing for plan and quota visibility.
 */

import type { UsageProvider } from "../base"
import { parseIntegerHeader } from "../../utils"
import { fetchFromUser, fetchFromV2Token } from "./fetch"
import { parseCopilotAccessToken, parseResetDate, resolveCopilotPlan, toRateWindow } from "./parse"
import type { CopilotAuth } from "./types"

export const CopilotProvider: UsageProvider<CopilotAuth> = {
  id: "github-copilot",
  displayName: "GitHub Copilot",

  parseRateLimitHeaders: (headers) => {
    const remainingTokens = parseIntegerHeader(new Headers(headers), "x-ratelimit-remaining-tokens")
    const remainingRequests = parseIntegerHeader(new Headers(headers), "x-ratelimit-remaining-requests")

    if (remainingTokens === null && remainingRequests === null) return null

    const estimatedTokenLimit = 10_000_000
    const estimatedRequestLimit = 200_000

    const primary =
      remainingTokens !== null
        ? {
            usedPercent: Math.max(
              0,
              Math.min(100, ((estimatedTokenLimit - remainingTokens) / estimatedTokenLimit) * 100),
            ),
            windowMinutes: 60,
            resetsAt: null,
          }
        : null

    const secondary =
      remainingRequests !== null
        ? {
            usedPercent: Math.max(
              0,
              Math.min(100, ((estimatedRequestLimit - remainingRequests) / estimatedRequestLimit) * 100),
            ),
            windowMinutes: null,
            resetsAt: null,
          }
        : null

    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "github-copilot",
      planType: null,
      primary,
      secondary,
      codeReview: null,
      credits: null,
    }
  },

  fetchUsage: async (auth) => {
    const refreshToken = auth.refresh
    const usageToken = auth.usageToken
    if (!refreshToken && !usageToken) return null

    const [v2Data, userData] = await Promise.all([
      refreshToken ? fetchFromV2Token(refreshToken) : Promise.resolve(null),
      usageToken ? fetchFromUser(usageToken) : refreshToken ? fetchFromUser(refreshToken) : Promise.resolve(null),
    ])

    const metadataSource = auth.access ?? v2Data?.token
    const tokenMetadata = metadataSource ? parseCopilotAccessToken(metadataSource) : {}
    const planType = resolveCopilotPlan({
      v2: v2Data,
      user: userData,
      metadataSku: tokenMetadata.sku,
    })

    const snapshots = userData?.quota_snapshots
    const primary = toRateWindow(snapshots?.premium_interactions ?? null)
    const secondary = toRateWindow(snapshots?.chat ?? null)
    const monthly = userData?.monthly_quotas ?? userData?.limited_user_quotas
    const chatLimit = monthly?.chat ?? v2Data?.limited_user_quotas?.chat ?? null
    const completionsLimit =
      monthly?.completions ?? v2Data?.limited_user_quotas?.completions ?? tokenMetadata.quotaLimit ?? null
    const resetAt =
      parseResetDate(userData?.quota_reset_date) ??
      parseResetDate(userData?.limited_user_reset_date) ??
      v2Data?.limited_user_reset_date ??
      tokenMetadata.resetDate

    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "github-copilot",
      planType,
      primary,
      secondary,
      codeReview: null,
      credits: completionsLimit
        ? {
            hasCredits: true,
            unlimited: false,
            balance: String(completionsLimit),
          }
        : null,
      quota: {
        chat: chatLimit,
        completions: completionsLimit,
        resetAt: resetAt ?? null,
      },
    }
  },
}

export type { CopilotAuth } from "./types"
