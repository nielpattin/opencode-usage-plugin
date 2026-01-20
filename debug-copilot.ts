import { providers } from "./providers/index"
import { getAuthFilePath } from "./utils/paths"

async function debug() {
  const authPath = "/home/igorw/.local/share/opencode/auth.json"
  console.log("Reading auth from:", authPath)

  const auths = await Bun.file(authPath).json()
  const copilotAuth = auths["github-copilot"]

  if (!copilotAuth) {
    console.error("No github-copilot auth found")
    return
  }

  const provider = providers["github-copilot"]
  if (!provider || !provider.fetchUsage) {
    console.error("Provider not found or missing fetchUsage")
    return
  }

  console.log("Fetching usage for copilot...")

  try {
    const snapshot = await provider.fetchUsage(copilotAuth)
    console.log("Snapshot result:", JSON.stringify(snapshot, null, 2))
  } catch (e) {
    console.error("Fetch failed:", e)
  }
}

debug()
