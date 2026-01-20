import { getAuthFilePath } from "./utils/paths"

async function probe() {
  // Load the new usage token
  const tokenPath = getAuthFilePath().replace("auth.json", "copilot-usage-token.json")
  const tokenData = await Bun.file(tokenPath).json().catch(() => null)
  
  if (!tokenData?.token) {
    console.log("No usage token found")
    return
  }
  
  const usageToken = tokenData.token
  console.log("Using token:", usageToken.slice(0, 20) + "...")

  // Try the copilot_internal/user endpoint with the usage token
  const response = await fetch("https://api.github.com/copilot_internal/user", {
    method: "GET",
    headers: {
      Authorization: `token ${usageToken}`,
      Accept: "application/json",
      "Editor-Version": "vscode/1.96.2",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
      "User-Agent": "GitHubCopilotChat/0.26.7",
      "X-Github-Api-Version": "2025-04-01",
    },
  })

  console.log("\nStatus:", response.status)
  
  if (response.ok) {
    const data = await response.json()
    console.log("\nFull response:")
    console.log(JSON.stringify(data, null, 2))
    
    // Check for quota_snapshots
    if (data.quota_snapshots) {
      console.log("\n✅ FOUND quota_snapshots!")
      console.log("premium_interactions:", data.quota_snapshots.premium_interactions)
      console.log("chat:", data.quota_snapshots.chat)
    } else {
      console.log("\n❌ No quota_snapshots field - keys:", Object.keys(data))
    }
  } else {
    console.log("Error:", await response.text())
  }
}

probe()
