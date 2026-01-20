/**
 * Implements /usage command handling and config registration.
 * Fetches live usage snapshots and renders a status message.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { UsageState } from "../state"
import { fetchUsageSnapshots } from "../usage"
import { renderUsageStatus, sendStatusMessage } from "../ui"
import { pollAccessToken, requestDeviceCode } from "../auth"
import { writeUsageToken } from "../utils"

type UsageClient = PluginInput["client"]

type CommandConfig = {
  template: string
  description: string
}

type UsageConfig = {
  command?: Record<string, CommandConfig>
}

const USAGE_CLIENT_ID = "Iv1.b507a08c87ecfe98"

export function commandHooks(options: {
  client: UsageClient
  state: UsageState
}): Pick<Hooks, "command.execute.before" | "config"> {
  return {
    config: async (input) => {
      const config = input as UsageConfig
      config.command ??= {}
      config.command["usage"] = {
        template: "/usage",
        description: "Show API usage and rate limits",
      }
      config.command["usage-auth"] = {
        template: "/usage-auth",
        description: "Authenticate Copilot usage token",
      }
    },

    "command.execute.before": async (input) => {
      if (input.command === "usage-auth") {
        const deviceData = await requestDeviceCode({
          clientId: USAGE_CLIENT_ID,
          scope: "read:user",
        })

        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: `Copilot usage auth\nOpen: ${deviceData.verification_uri}\nCode: ${deviceData.user_code}`,
        })

        const token = await pollAccessToken({
          clientId: USAGE_CLIENT_ID,
          deviceCode: deviceData,
        })

        await writeUsageToken(token)
        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: "Copilot usage token saved.",
        })

        throw new Error("__USAGE_AUTH_HANDLED__")
      }
      if (input.command !== "usage") return
      const snapshots = await fetchUsageSnapshots()
      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots,
      })
      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
