import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const tokenPath = getAuthFilePath().replace("auth.json", "copilot-usage-token.json")
  const tokenData = await Bun.file(tokenPath).json().catch(() => null)
  const usageToken = tokenData?.token
  
  const auths = await Bun.file(getAuthFilePath()).json()
  const refreshToken = auths["github-copilot"]?.refresh

  if (!usageToken && !refreshToken) {
    console.log("No tokens found")
    return
  }

  const endpoints = [
    // Try GitHub API endpoints that might have usage
    "https://api.github.com/user/copilot/usage",
    "https://api.github.com/copilot_internal/v3/user",
    "https://api.github.com/copilot_internal/user/usage",
    "https://api.github.com/copilot_internal/user/quotas",
    "https://api.github.com/copilot_internal/v2/user/quota",
    "https://api.github.com/copilot_internal/limited_user",
    "https://api.github.com/copilot_internal/v2/limited_user",
    // GraphQL might have usage data
    "https://api.github.com/graphql",
  ]

  const tokens = [
    { name: "usage", token: usageToken },
    { name: "refresh", token: refreshToken },
  ].filter(t => t.token)

  for (const endpoint of endpoints) {
    for (const t of tokens) {
      try {
        const isGraphQL = endpoint.includes("graphql")
        const options: RequestInit = {
          method: isGraphQL ? "POST" : "GET",
          headers: {
            Authorization: `${isGraphQL ? "bearer" : "token"} ${t.token}`,
            Accept: "application/json",
            "User-Agent": "GitHubCopilotChat/0.26.7",
          },
        }
        
        if (isGraphQL) {
          options.body = JSON.stringify({
            query: `{ viewer { copilotLimitedUserQuota { chat { used limit } completions { used limit } resetDate } } }`
          })
        }

        const res = await fetch(endpoint, options)
        
        if (res.ok) {
          const data = await res.json()
          // Check if it has usage data
          const hasUsage = JSON.stringify(data).includes("used") || 
                          JSON.stringify(data).includes("remaining") ||
                          JSON.stringify(data).includes("percent")
          if (hasUsage) {
            console.log(`\n✅ ${endpoint} (${t.name}):`)
            console.log(JSON.stringify(data, null, 2))
          }
        }
      } catch {}
    }
  }

  // Also try the v2/token endpoint to see full response
  console.log("\n--- Checking v2/token for additional fields ---")
  const tokenRes = await fetch("https://api.github.com/copilot_internal/v2/token", {
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      "User-Agent": "GitHubCopilot/1.155.0",
      Accept: "application/json",
    },
  })
  
  if (tokenRes.ok) {
    const data = await tokenRes.json()
    console.log("v2/token keys:", Object.keys(data))
    // Check for any usage-related fields
    for (const [key, val] of Object.entries(data)) {
      if (key.includes("quota") || key.includes("usage") || key.includes("limit") || key.includes("remain")) {
        console.log(`  ${key}:`, val)
      }
    }
  }
}

probe()
