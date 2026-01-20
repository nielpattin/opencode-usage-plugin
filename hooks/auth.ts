/**
 * Implements Copilot device-flow auth using the VS Code client ID.
 * Aligns token behavior with CodexBar to access usage snapshots.
 */

import type { Hooks } from "@opencode-ai/plugin"
import { pollAccessToken, requestDeviceCode } from "../auth"

const CLIENT_ID = "Ov23li8tweQw6odWQebz"

export function authHooks(): Pick<Hooks, "auth"> {
  return {
    auth: {
      provider: "github-copilot",
      methods: [
        {
          type: "oauth",
          label: "Login with GitHub Copilot",
          async authorize() {
            const deviceData = await requestDeviceCode({
              clientId: CLIENT_ID,
              scope: "read:user",
            })

            return {
              url: deviceData.verification_uri,
              instructions: `Enter code: ${deviceData.user_code}`,
              method: "auto" as const,
              async callback() {
                const token = await pollAccessToken({
                  clientId: CLIENT_ID,
                  deviceCode: deviceData,
                })
                return {
                  type: "success" as const,
                  refresh: token,
                  access: token,
                  expires: 0,
                }
              },
            }
          },
        },
      ],
    },
  }
}
