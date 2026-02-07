import type { UsageProvider } from "../base"
import type { UsageSnapshot } from "../../types"
import { fetchAnthropicProfile, fetchAnthropicUsage } from "./fetch"
import { buildAnthropicQuota, inferAnthropicPlanType } from "./parse"

export type AnthropicAuth = {
  access?: string
  key?: string
}

export const AnthropicProvider: UsageProvider<AnthropicAuth> = {
  id: "anthropic",
  displayName: "Anthropic Claude",
  usageEndpoint: "https://api.anthropic.com/api/oauth/usage",

  async fetchUsage(auth): Promise<UsageSnapshot | null> {
    const token = auth?.access || auth?.key
    if (!token) return null

    const [usage, profile] = await Promise.all([
      fetchAnthropicUsage(token),
      fetchAnthropicProfile(token),
    ])

    if (!usage) return null

    return {
      timestamp: Date.now(),
      updatedAt: Date.now(),
      provider: "anthropic",
      planType: inferAnthropicPlanType(profile),
      primary: null,
      secondary: null,
      codeReview: null,
      credits: null,
      anthropicQuota: buildAnthropicQuota(usage, profile),
    }
  },
}
