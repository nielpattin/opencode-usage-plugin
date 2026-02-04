/**
 * Fetch logic for Z.ai usage monitoring.
 */

import { loadUsageConfig } from "../../usage/config"
import type { ZaiAuth, ZaiQuotaResponse, ZaiModelUsageResponse, ZaiToolUsageResponse } from "./types"

export async function fetchZaiUsage(auth: ZaiAuth) {
  const config = await loadUsageConfig().catch(() => null)
  const baseUrl = config?.zaiEndpoint?.replace(/\/$/, "") || "https://api.z.ai"
  const monitorUrl = `${baseUrl}/api/monitor/usage`

  const now = new Date()

  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0)
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000)

  const formatDateTime = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  const startTime = formatDateTime(startDate)
  const endTime = formatDateTime(endDate)
  const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`

  const headers = {
    "Authorization": auth.key,
    "Accept-Language": "en-US,en",
    "Content-Type": "application/json",
  }

  const [quotaRes, modelRes, toolRes] = await Promise.all([
    fetch(`${monitorUrl}/quota/limit`, { headers }),
    fetch(`${monitorUrl}/model-usage${queryParams}`, { headers }),
    fetch(`${monitorUrl}/tool-usage${queryParams}`, { headers }),
  ])

  if (!quotaRes.ok) {
    throw new Error(`Z.ai quota query failed: ${quotaRes.status} ${await quotaRes.text()}`)
  }

  const quota = (await quotaRes.json()) as ZaiQuotaResponse
  const model = modelRes.ok ? ((await modelRes.json()) as ZaiModelUsageResponse) : null
  const tool = toolRes.ok ? ((await toolRes.json()) as ZaiToolUsageResponse) : null

  return {
    quota: quota.data,
    model: model?.data,
    tool: tool?.data,
  }
}
