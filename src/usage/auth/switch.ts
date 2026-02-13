import { join } from "path"
import z from "zod"
import { getDataPath } from "../../utils"

const OPENAI_OAUTH_ISSUER = "https://auth.openai.com"
const OPENAI_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const REFRESH_MARGIN_MS = 30_000

const openAIAuthorizationSchema = z
  .object({
    type: z.string().optional(),
    access: z.string(),
    refresh: z.string(),
    expires: z.coerce.number(),
    accountId: z.string().optional(),
    enterpriseUrl: z.string().optional(),
  })
  .passthrough()

const authObjectSchema = z.record(z.string(), z.unknown())

const currentOpenAISchema = z
  .object({
    type: z.string().optional(),
    access: z.string().optional(),
    refresh: z.string().optional(),
    expires: z.coerce.number().optional(),
    accountId: z.string().optional(),
  })
  .passthrough()

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  id_token: z.string().optional(),
})

type TokenResponse = z.infer<typeof tokenResponseSchema>

type OpenAIOAuth = {
  type: "oauth"
  access: string
  refresh: string
  expires: number
  accountId?: string
  enterpriseUrl?: string
}

type OpenAICandidate = {
  label: string
  auth: OpenAIOAuth
}

type OpenAIOAuthIdentity = {
  access?: string
  refresh?: string
  expires?: number
  accountId?: string
}

type OpenAISwitchError = {
  ok: false
  reason: string
}

type OpenAISwitchSuccess = {
  ok: true
  selected: OpenAICandidate
  selectedOrder: number
  previousLabel?: string
  previousOrder?: number
  total: number
}

export type OpenAISwitchResult = OpenAISwitchError | OpenAISwitchSuccess

export async function cycleOpenAIOAuth(orderNumber?: number): Promise<OpenAISwitchResult> {
  const openAIAccountsPath = join(getDataPath(), "openai.json")
  const candidates = await loadOpenAICandidates(openAIAccountsPath)
  if (!candidates.ok) return candidates

  const current = await loadCurrentOpenAIAuth(join(getDataPath(), "auth.json"))
  const currentIndex = current ? findCurrentIndex(candidates.value, current) : -1

  if (orderNumber !== undefined) {
    if (!Number.isInteger(orderNumber) || orderNumber < 1) {
      return {
        ok: false,
        reason: "Order number must be a positive integer (1-based)",
      }
    }
    if (orderNumber > candidates.value.length) {
      return {
        ok: false,
        reason: `Order number ${orderNumber} is out of range (1-${candidates.value.length})`,
      }
    }

    const targetIndex = orderNumber - 1
    return {
      ok: true,
      selected: candidates.value[targetIndex],
      selectedOrder: targetIndex + 1,
      previousLabel: currentIndex >= 0 ? candidates.value[currentIndex].label : undefined,
      previousOrder: currentIndex >= 0 ? currentIndex + 1 : undefined,
      total: candidates.value.length,
    }
  }

  const nextIndex = (currentIndex + 1) % candidates.value.length

  return {
    ok: true,
    selected: candidates.value[nextIndex],
    selectedOrder: nextIndex + 1,
    previousLabel: currentIndex >= 0 ? candidates.value[currentIndex].label : undefined,
    previousOrder: currentIndex >= 0 ? currentIndex + 1 : undefined,
    total: candidates.value.length,
  }
}

export async function ensureFreshOpenAIOAuth(auth: OpenAIOAuth): Promise<OpenAIOAuth> {
  if (auth.expires > Date.now() + REFRESH_MARGIN_MS) return auth
  return refreshOpenAIOAuth(auth)
}

async function loadOpenAICandidates(path: string): Promise<{ ok: true; value: OpenAICandidate[] } | OpenAISwitchError> {
  try {
    const file = Bun.file(path)
    if (!(await file.exists())) {
      return {
        ok: false,
        reason: `No OpenAI account list found at ${path}`,
      }
    }

    const data = await file.json()
    const parsed = authObjectSchema.safeParse(data)
    if (!parsed.success) {
      return {
        ok: false,
        reason: `Invalid OpenAI account list format in ${path}`,
      }
    }

    const candidates: OpenAICandidate[] = []
    for (const [label, value] of Object.entries(parsed.data)) {
      const oauth = parseOpenAIOAuth(value)
      if (!oauth) continue

      candidates.push({
        label,
        auth: oauth,
      })
    }

    const value = candidates
    if (value.length === 0) {
      return {
        ok: false,
        reason: `No valid OpenAI OAuth entries found in ${path}`,
      }
    }

    return { ok: true, value }
  } catch (error: any) {
    return {
      ok: false,
      reason: `Failed to read ${path}: ${error?.message || "unknown error"}`,
    }
  }
}

function parseOpenAIOAuth(value: unknown): OpenAIOAuth | null {
  const parsed = openAIAuthorizationSchema.safeParse(value)
  if (!parsed.success) return null
  if (parsed.data.type && parsed.data.type !== "oauth" && parsed.data.type !== "token") return null

  return {
    type: "oauth",
    access: parsed.data.access,
    refresh: parsed.data.refresh,
    expires: parsed.data.expires,
    accountId: parsed.data.accountId,
    enterpriseUrl: parsed.data.enterpriseUrl,
  }
}

async function refreshOpenAIOAuth(auth: OpenAIOAuth): Promise<OpenAIOAuth> {
  const response = await fetch(`${OPENAI_OAUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: auth.refresh,
      client_id: OPENAI_OAUTH_CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`token refresh failed (${response.status})`)
  }

  const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) {
    throw new Error("token refresh payload invalid")
  }

  const accountId =
    extractAccountId(parsed.data.id_token) ||
    extractAccountId(parsed.data.access_token) ||
    auth.accountId

  return {
    type: "oauth",
    access: parsed.data.access_token,
    refresh: parsed.data.refresh_token || auth.refresh,
    expires: Date.now() + (parsed.data.expires_in ?? 3600) * 1000,
    accountId,
    enterpriseUrl: auth.enterpriseUrl,
  }
}

async function loadCurrentOpenAIAuth(path: string): Promise<OpenAIOAuthIdentity | null> {
  try {
    const file = Bun.file(path)
    if (!(await file.exists())) return null

    const data = await file.json()
    const parsed = authObjectSchema.safeParse(data)
    if (!parsed.success) return null

    const raw = parsed.data.openai
    const current = currentOpenAISchema.safeParse(raw)
    if (!current.success) return null

    return current.data
  } catch {
    return null
  }
}

function fingerprint(value: OpenAIOAuthIdentity): string {
  return [value.accountId || "", value.access || "", value.refresh || "", String(value.expires || "")].join("|")
}

function findCurrentIndex(candidates: OpenAICandidate[], current: OpenAIOAuthIdentity): number {
  let bestIndex = -1
  let bestScore = 0

  for (let i = 0; i < candidates.length; i++) {
    const score = candidateMatchScore(candidates[i].auth, current)
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return bestIndex
}

function candidateMatchScore(candidate: OpenAIOAuthIdentity, current: OpenAIOAuthIdentity): number {
  let score = 0
  if (candidate.refresh && current.refresh && candidate.refresh === current.refresh) score += 16
  if (candidate.accountId && current.accountId && candidate.accountId === current.accountId) score += 8
  if (candidate.access && current.access && candidate.access === current.access) score += 4
  if (candidate.expires && current.expires && candidate.expires === current.expires) score += 1
  if (score === 0 && fingerprint(candidate) === fingerprint(current)) score = 1
  return score
}

function extractAccountId(token: string | undefined): string | undefined {
  if (!token) return undefined
  const claims = parseJwtClaims(token)
  if (!claims) return undefined

  const chatgptAccountId = claims.chatgpt_account_id
  if (typeof chatgptAccountId === "string") return chatgptAccountId

  const authNamespace = claims["https://api.openai.com/auth"]
  if (authNamespace && typeof authNamespace === "object" && "chatgpt_account_id" in authNamespace) {
    const nested = (authNamespace as Record<string, unknown>).chatgpt_account_id
    if (typeof nested === "string") return nested
  }

  const organizations = claims.organizations
  if (Array.isArray(organizations)) {
    const first = organizations[0]
    if (first && typeof first === "object" && "id" in first) {
      const organizationId = (first as Record<string, unknown>).id
      if (typeof organizationId === "string") return organizationId
    }
  }

  return undefined
}

function parseJwtClaims(token: string): Record<string, unknown> | undefined {
  const parts = token.split(".")
  if (parts.length !== 3) return undefined
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()) as Record<string, unknown>
  } catch {
    return undefined
  }
}
