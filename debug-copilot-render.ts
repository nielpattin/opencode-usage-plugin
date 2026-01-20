import { providers } from "./providers/index"
import { getAuthFilePath } from "./utils/paths"

async function debug() {
  const authPath = getAuthFilePath()
  console.log("Reading auth from:", authPath)

  const auths = await Bun.file(authPath).json()
  const copilotAuth = auths["github-copilot"]

  if (!copilotAuth) {
    console.error("No github-copilot auth found")
    return
  }

  const provider = providers["github-copilot"]
  console.log("Fetching usage for copilot...")

  try {
    const snapshot = await provider.fetchUsage(copilotAuth)
    console.log("Snapshot result:", JSON.stringify(snapshot, null, 2))

    // Simulate what index.ts does
    const s = snapshot
    let status = `→ [${s.provider}]${s.planType}`

    if (s.provider === "github-copilot") {
      const parts = []
      if (s.quota?.completions !== null && s.quota?.completions !== undefined)
        parts.push(`Completions: ${s.quota.completions}`)
      if (s.quota?.chat !== null && s.quota?.chat !== undefined) parts.push(`Chat: ${s.quota.chat}`)
      if (s.quota?.resetAt) parts.push(`(resets in ${s.quota.resetAt})`)

      console.log("Constructed parts:", parts)
      if (parts.length > 0) status += ` | ${parts.join(" | ")}`
      else status += " | No quota info available"
    }
    console.log("Final status string:", status)
  } catch (e) {
    console.error("Fetch failed:", e)
  }
}

debug()
