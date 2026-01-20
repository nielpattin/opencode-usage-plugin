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

  // FORCE refresh
  console.log("Forcing token refresh...")
  const refreshResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: "Iv1.b507a08c87ecfe98", // Standard VS Code client ID
      grant_type: "refresh_token",
      refresh_token: copilotAuth.refresh,
    }),
  })

  if (!refreshResponse.ok) {
    console.log("Refresh failed:", await refreshResponse.text())
  } else {
    const tokens = await refreshResponse.json()
    console.log("Refreshed tokens:", tokens)
    if (tokens.access_token) {
      copilotAuth.access = tokens.access_token
      copilotAuth.refresh = tokens.refresh_token // Update for next time
      console.log("Updated access token.")
    }
  }

  const provider = providers["github-copilot"]
  console.log("Fetching usage for copilot with (potentially) fresh token...")

  try {
    const snapshot = await provider.fetchUsage(copilotAuth)
    console.log("Snapshot result:", JSON.stringify(snapshot, null, 2))
  } catch (e) {
    console.error("Fetch failed:", e)
  }
}

debug()
