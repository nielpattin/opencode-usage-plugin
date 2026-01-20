import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]
  const refresh = auth.refresh // ghu_ token

  // Try the copilot_internal/user endpoint with exact headers from PR #9545
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    method: "GET",
    headers: {
      Authorization: `token ${refresh}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
      "User-Agent": "GitHubCopilotChat/0.26.7",
      "X-Github-Api-Version": "2025-04-01",
    },
  })

  console.log("Status:", response.status)
  if (response.ok) {
    const data = await response.json()
    console.log("\nFull response:")
    console.log(JSON.stringify(data, null, 2))
    
    // Check for quota_snapshots specifically
    if (data.quota_snapshots) {
      console.log("\n✅ FOUND quota_snapshots!")
      console.log("premium_interactions:", data.quota_snapshots.premium_interactions)
      console.log("chat:", data.quota_snapshots.chat)
    } else {
      console.log("\n❌ No quota_snapshots field")
    }
  } else {
    console.log("Error:", await response.text())
  }
}

probe()
