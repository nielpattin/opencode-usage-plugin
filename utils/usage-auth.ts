/**
 * Stores a dedicated Copilot usage token for quota snapshots.
 * Keeps usage auth separate from core OpenCode credentials.
 */

import { mkdir } from "fs/promises"
import { join } from "path"
import { getAppDataPath } from "./paths"

type UsageTokenRecord = {
  token: string
  createdAt: number
}

const USAGE_TOKEN_FILE = "copilot-usage-token.json"

export function getUsageTokenPath(): string {
  return join(getAppDataPath(), USAGE_TOKEN_FILE)
}

export async function readUsageToken(): Promise<string | null> {
  const payload = await Bun.file(getUsageTokenPath())
    .json()
    .catch(() => null)
  if (!payload || typeof payload !== "object") return null
  const token = (payload as UsageTokenRecord).token
  if (!token || typeof token !== "string") return null
  return token
}

export async function writeUsageToken(token: string): Promise<void> {
  const record: UsageTokenRecord = { token, createdAt: Date.now() }
  await mkdir(getAppDataPath(), { recursive: true })
  await Bun.write(getUsageTokenPath(), JSON.stringify(record, null, 2))
}
