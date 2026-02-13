/**
 * Implements /usage command handling and config registration.
 * Fetches live usage snapshots and renders a status message.
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { UsageState } from "../state"
import { fetchUsageSnapshots, resolveProviderFilter } from "../usage"
import { renderUsageStatus, sendStatusMessage } from "../ui"
import { cycleOpenAIOAuth, ensureFreshOpenAIOAuth } from "../usage/auth/switch"

type UsageClient = PluginInput["client"]

type CommandConfig = {
  template: string
  description: string
}

type UsageConfig = {
  command?: Record<string, CommandConfig>
}

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
        description: "Show API usage and rate limits (codex/codexs/proxy or all)",
      }
      config.command["switch"] = {
        template: "/switch",
        description: "Cycle OpenAI OAuth account and show current Codex usage",
      }
    },

    "command.execute.before": async (input) => {
      if (input.command === "switch") {
        const switched = await cycleOpenAIOAuth()
        if (!switched.ok) {
          await sendStatusMessage({
            client: options.client,
            state: options.state,
            sessionID: input.sessionID,
            text: `▣ Switch failed\n\n${switched.reason}`,
          })
          throw new Error("__USAGE_SWITCH_HANDLED__")
        }

        let selectedAuth = switched.selected.auth
        let refreshWarning = ""
        try {
          selectedAuth = await ensureFreshOpenAIOAuth(switched.selected.auth)
        } catch (error: any) {
          refreshWarning = `\n\nToken refresh failed: ${error?.message || "unknown error"}`
        }

        const setResult = await options.client.auth
          .set({
            path: { id: "openai" },
            body: selectedAuth,
          })
          .catch((error) => ({ error }))

        if ((setResult as any)?.error) {
          await sendStatusMessage({
            client: options.client,
            state: options.state,
            sessionID: input.sessionID,
            text: `▣ Switch failed\n\nUnable to update openai auth in auth.json`,
          })
          throw new Error("__USAGE_SWITCH_HANDLED__")
        }

        await options.client.instance.dispose().catch(() => {})

        const snapshots = await fetchUsageSnapshots("codex")
        const labeledSnapshots = snapshots.map((snapshot) => {
          if (snapshot.provider !== "codex") return snapshot
          return {
            ...snapshot,
            accountLabel: switched.selected.label,
          }
        })

        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: `▣ Switched OpenAI OAuth\n\n${switched.previousLabel ? `From [${switched.previousLabel}] ` : ""}Now [${
            switched.selected.label
          }] (${switched.total} total)${refreshWarning}`,
        })

        await renderUsageStatus({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          snapshots: labeledSnapshots,
          filter: "codex",
        })

        throw new Error("__USAGE_SWITCH_HANDLED__")
      }

      if (input.command !== "usage") return

      const args = input.arguments?.trim() || ""
      const argKey = args.toLowerCase()
      const allOpenAIAccounts = argKey === "codexs"

      if (args === "support") {
        await sendStatusMessage({
          client: options.client,
          state: options.state,
          sessionID: input.sessionID,
          text: "▣ Support Mirrowel Proxy\n\nSupport our lord and savior: https://ko-fi.com/mirrowel",
        })
        throw new Error("__USAGE_SUPPORT_HANDLED__")
      }

      const filter = args || undefined
      const targetProvider = resolveProviderFilter(filter)

      let effectiveFilter = targetProvider ? filter : undefined
      if (allOpenAIAccounts) effectiveFilter = "codex"

      const snapshots = await fetchUsageSnapshots(effectiveFilter, {
        allOpenAIAccounts,
      })

      const filteredSnapshots = snapshots.filter(s => {
        if (targetProvider) return true
        if (s.provider === "codex") return options.state.availableProviders.codex
        if (s.provider === "proxy") return options.state.availableProviders.proxy
        if (s.provider === "copilot") return options.state.availableProviders.copilot
        return true
      })

      await renderUsageStatus({
        client: options.client,
        state: options.state,
        sessionID: input.sessionID,
        snapshots: filteredSnapshots,
        filter: effectiveFilter,
      })

      throw new Error("__USAGE_COMMAND_HANDLED__")
    },
  }
}
