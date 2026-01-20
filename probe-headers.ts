import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]
  
  // First get a fresh token
  const tokenRes = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `Bearer ${auth.refresh}`,
      "User-Agent": "GitHubCopilot/1.155.0",
      Accept: "application/json",
      "Editor-Version": "vscode/1.85.0",
      "Editor-Plugin-Version": "copilot/1.155.0",
    },
  })
  
  const tokenData = await tokenRes.json()
  console.log("Token data keys:", Object.keys(tokenData))
  console.log("limited_user_quotas:", tokenData.limited_user_quotas)
  console.log("limited_user_reset_date:", tokenData.limited_user_reset_date)
  
  const copilotToken = tokenData.token
  
  // Try a HEAD request to chat endpoint
  console.log("\n--- Trying HEAD request to chat endpoint ---")
  try {
    const headRes = await fetch("https://api.individual.githubcopilot.com/chat/completions", {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "User-Agent": "GitHubCopilot/1.155.0",
      },
    })
    console.log("HEAD status:", headRes.status)
    console.log("Headers:")
    for (const [k, v] of headRes.headers.entries()) {
      if (k.includes("ratelimit") || k.includes("limit") || k.includes("quota") || k.includes("remaining")) {
        console.log(`  ${k}: ${v}`)
      }
    }
  } catch (e) {
    console.log("HEAD error:", e.message)
  }

  // Try OPTIONS request
  console.log("\n--- Trying OPTIONS request ---")
  try {
    const optRes = await fetch("https://api.individual.githubcopilot.com/chat/completions", {
      method: "OPTIONS",
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "User-Agent": "GitHubCopilot/1.155.0",
      },
    })
    console.log("OPTIONS status:", optRes.status)
    for (const [k, v] of optRes.headers.entries()) {
      console.log(`  ${k}: ${v}`)
    }
  } catch (e) {
    console.log("OPTIONS error:", e.message)
  }

  // Try a minimal POST that might fail but return headers
  console.log("\n--- Trying minimal POST (empty body) ---")
  try {
    const postRes = await fetch("https://api.individual.githubcopilot.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "User-Agent": "GitHubCopilot/1.155.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
    console.log("POST status:", postRes.status)
    console.log("Rate limit headers:")
    for (const [k, v] of postRes.headers.entries()) {
      if (k.includes("ratelimit") || k.includes("limit") || k.includes("remaining") || k.includes("reset")) {
        console.log(`  ${k}: ${v}`)
      }
    }
    const body = await postRes.text()
    console.log("Body:", body.slice(0, 300))
  } catch (e) {
    console.log("POST error:", e.message)
  }
}

probe()
