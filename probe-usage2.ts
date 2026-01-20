import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]
  const refresh = auth.refresh

  // More endpoints to try
  const endpoints = [
    "https://api.github.com/copilot_internal/metering",
    "https://api.github.com/copilot_internal/billing",
    "https://api.github.com/copilot_internal/stats",
    "https://api.github.com/copilot_internal/metrics",
    "https://api.github.com/copilot_internal/v2/limits",
    "https://api.github.com/copilot_internal/rate_limit",
    "https://api.github.com/copilot_internal/v2/rate_limit",
    "https://api.github.com/copilot_internal/quotas",
    "https://api.github.com/copilot_internal/v2/quotas",
    // Try the proxy endpoint
    "https://api.individual.githubcopilot.com/user",
    "https://api.individual.githubcopilot.com/usage",
    "https://api.individual.githubcopilot.com/quota",
    "https://api.individual.githubcopilot.com/limits",
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

  // Also try with the access token (copilot token) for proxy endpoints
  console.log("\n--- Trying with access token on proxy ---")
  const access = auth.access
  const proxyEndpoints = [
    "https://api.individual.githubcopilot.com/usage",
    "https://api.individual.githubcopilot.com/user",
    "https://api.individual.githubcopilot.com/quota",
    "https://api.individual.githubcopilot.com/_ping",
  ]
  
  for (const url of proxyEndpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${access}`,
          "User-Agent": "GitHubCopilot/1.155.0",
          Accept: "application/json",
        },
      })
      console.log(`${url} - ${res.status}`)
      if (res.status === 200) {
        const text = await res.text()
        console.log(text.slice(0, 500))
      }
    } catch (e) {
      console.log(`${url} - ${e.message}`)
    }
  }
}

probe()
