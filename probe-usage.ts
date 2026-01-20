import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]

  if (!auth) {
    console.error("No auth")
    return
  }

  const refresh = auth.refresh

  // Try various endpoints that might have usage data
  const endpoints = [
    "https://api.github.com/copilot_internal/user",
    "https://api.github.com/copilot_internal/usage",
    "https://api.github.com/copilot_internal/v2/usage",
    "https://api.github.com/copilot_internal/quota",
    "https://api.github.com/copilot_internal/limits",
    "https://api.github.com/user",
    "https://api.github.com/copilot/usage",
    "https://api.github.com/copilot_internal/v2/user",
    "https://api.github.com/copilot_internal/subscription",
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${refresh}`,
          "User-Agent": "GitHubCopilot/1.155.0",
          Accept: "application/json",
          "Editor-Version": "vscode/1.85.0",
          "Editor-Plugin-Version": "copilot/1.155.0",
        },
      })
      if (res.status === 200) {
        const json = await res.json()
        console.log(`\n✅ ${url}`)
        console.log(JSON.stringify(json, null, 2))
      } else {
        console.log(`❌ ${url} - ${res.status}`)
      }
    } catch (e) {
      console.log(`❌ ${url} - ${e.message}`)
    }
  }
}

probe()
