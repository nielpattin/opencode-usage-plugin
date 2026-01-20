/**
 * Runs the GitHub OAuth device flow for Copilot tokens.
 * Returns the access token string on success.
 */

import z from "zod"

const DEVICE_CODE_URL = "https://github.com/login/device/code"
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000

const deviceCodeSchema = z.object({
  verification_uri: z.string(),
  user_code: z.string(),
  device_code: z.string(),
  interval: z.number(),
})

const accessTokenSchema = z.object({
  access_token: z.string().optional(),
  error: z.string().optional(),
  interval: z.number().optional(),
})

export type DeviceCode = z.infer<typeof deviceCodeSchema>

export async function requestDeviceCode(options: { clientId: string; scope: string }): Promise<DeviceCode> {
  const deviceResponse = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: options.clientId,
      scope: options.scope,
    }),
  })

  if (!deviceResponse.ok) {
    throw new Error("Failed to initiate device authorization")
  }

  const deviceJson = await deviceResponse.json().catch(() => null)
  const deviceParsed = deviceCodeSchema.safeParse(deviceJson)
  if (!deviceParsed.success) {
    throw new Error("Invalid device authorization response")
  }

  return deviceParsed.data
}

export async function pollAccessToken(options: { clientId: string; deviceCode: DeviceCode }): Promise<string> {
  const deviceData = options.deviceCode
  while (true) {
    const response = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: options.clientId,
        device_code: deviceData.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to obtain access token")
    }

    const json = await response.json().catch(() => null)
    const parsed = accessTokenSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error("Invalid access token response")
    }

      const data = parsed.data
    if (data.access_token) return data.access_token

    if (data.error === "authorization_pending") {
      const delayMs = deviceData.interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS
      await Bun.sleep(delayMs)
      continue
    }

    if (data.error === "slow_down") {
      const interval = data.interval ?? deviceData.interval
      const delayMs = (interval + 5) * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS
      await Bun.sleep(delayMs)
      continue
    }

    if (data.error) {
      throw new Error(`Device flow failed: ${data.error}`)
    }

    const delayMs = deviceData.interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS
    await Bun.sleep(delayMs)
  }
}
