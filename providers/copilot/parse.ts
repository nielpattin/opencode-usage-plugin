/**
 * Copilot parsing helpers for plans, tokens, and snapshots.
 * Converts response data into normalized usage windows.
 */

import type { PlanType } from "../../types"
import type { CopilotQuotaSnapshot, CopilotUserResponse, CopilotV2TokenResponse } from "./types"

const COPILOT_SKU_PLAN_MAP: Record<string, PlanType> = {
  free_limited_copilot: "free",
  copilot_for_individual: "pro",
  copilot_individual: "pro",
  copilot_business: "business",
  copilot_enterprise: "enterprise",
  copilot_for_business: "business",
}

type CopilotTokenMetadata = {
  tid?: string
  exp?: number
  sku?: string
  proxyEndpoint?: string
  quotaLimit?: number
  resetDate?: number
}

export function parseCopilotAccessToken(accessToken: string): CopilotTokenMetadata {
  const result: CopilotTokenMetadata = {}
  const parts = accessToken.split(";")

  for (const part of parts) {
    const eqIndex = part.indexOf("=")
    if (eqIndex === -1) continue
    const key = part.slice(0, eqIndex)
    const value = part.slice(eqIndex + 1)

    switch (key) {
      case "tid":
        result.tid = value
        break
      case "exp":
        result.exp = Number.parseInt(value, 10)
        break
      case "sku":
        result.sku = value
        break
      case "proxy-ep":
        result.proxyEndpoint = value
        break
      case "cq":
        result.quotaLimit = Number.parseInt(value, 10)
        break
      case "rd": {
        const colonIdx = value.indexOf(":")
        if (colonIdx > 0) {
          result.resetDate = Number.parseInt(value.slice(0, colonIdx), 10)
        }
        break
      }
    }
  }

  return result
}

export function resolveCopilotPlan(options: {
  v2?: CopilotV2TokenResponse | null
  user?: CopilotUserResponse | null
  metadataSku?: string
}): PlanType | null {
  return (
    copilotSkuToPlan(options.v2?.sku) ??
    copilotSkuToPlan(options.user?.access_type_sku) ??
    copilotSkuToPlan(options.metadataSku) ??
    copilotSkuToPlanType(options.user?.copilot_plan ?? "")
  )
}

export function parseResetDate(value: string | number | undefined): number | null {
  if (!value) return null
  if (typeof value === "number") return value
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null
  return Math.round(parsed / 1000)
}

export function toRateWindow(snapshot: CopilotQuotaSnapshot | null) {
  if (!snapshot) return null
  const usedPercent = Math.max(0, Math.min(100, 100 - snapshot.percent_remaining))
  return {
    usedPercent,
    windowMinutes: null,
    resetsAt: null,
  }
}

function copilotSkuToPlan(sku: string | undefined): PlanType | null {
  if (!sku) return null
  return COPILOT_SKU_PLAN_MAP[sku] ?? copilotSkuToPlanType(sku)
}

function copilotSkuToPlanType(sku: string): PlanType | null {
  const normalized = sku.toLowerCase()
  if (normalized.includes("free")) return "free"
  if (normalized.includes("individual") || normalized.includes("pro")) return "pro"
  if (normalized.includes("business")) return "business"
  if (normalized.includes("enterprise")) return "enterprise"
  return null
}
