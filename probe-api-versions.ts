import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]
  const refresh = auth.refresh

  // Try different API versions
  const versions = [
    "2025-04-01",
    "2024-12-01",
    "2024-01-01",
    "2022-11-28",
    undefined, // no version header
  ]

  for (const version of versions) {
    const headers: Record<string, string> = {
      Authorization: `token ${refresh}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
      "User-Agent": "GitHubCopilotChat/0.26.7",
    }
    if (version) headers["X-Github-Api-Version"] = version

    const response = await fetch("https://api.github.com/copilot_internal/user", {
      method: "GET",
      headers,
    })

    const data = await response.json()
    const hasQuotaSnapshots = !!data.quota_snapshots
    const hasUsage = !!(data.usage || data.used || data.remaining)
    
    console.log(`API Version ${version || 'none'}: quota_snapshots=${hasQuotaSnapshots}, keys=${Object.keys(data).join(',')}`)
    
    if (hasQuotaSnapshots || hasUsage) {
      console.log("FOUND:", JSON.stringify(data, null, 2))
      break
    }
  }

  // Also try copilot_internal/v2/user_quota endpoint
  console.log("\n--- Trying other endpoints ---")
  const endpoints = [
    "https://api.github.com/copilot_internal/user_quota",
    "https://api.github.com/copilot_internal/v2/user_quota", 
    "https://api.github.com/copilot_internal/quota",
    "https://api.github.com/copilot_internal/usage_stats",
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `token ${refresh}`,
          Accept: "application/json",
          "User-Agent": "GitHubCopilotChat/0.26.7",
        },
      })
      if (res.ok) {
        console.log(`✅ ${url}:`, await res.json())
      } else {
        console.log(`❌ ${url}: ${res.status}`)
      }
    } catch (e) {
      console.log(`❌ ${url}: error`)
    }
  }
}

probe()
