import { getAuthFilePath } from "./utils/paths"

async function probe() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]

  if (!auth) {
    console.error("No auth")
    return
  }

  const endpoints = [
    "https://api.github.com/copilot_internal/v2/token",
    "https://api.github.com/user/copilot",
    "https://api.github.com/copilot_internal/notification/banner/editor",
  ]

  const tokens = [
    { name: "Access", val: auth.access },
    { name: "Refresh", val: auth.refresh },
  ]

  for (const url of endpoints) {
    console.log(`\n--- Probing ${url} ---`)
    for (const t of tokens) {
      try {
        console.log(`Trying ${t.name} token...`)
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${t.val}`,
            "User-Agent": "GitHubCopilot/1.155.0",
            Accept: "application/json",
            "Editor-Version": "vscode/1.85.0",
            "Editor-Plugin-Version": "copilot/1.155.0",
          },
        })
        console.log(`Status: ${res.status}`)
        if (res.ok) {
          const json = await res.json()
          console.log("SUCCESS BODY:", JSON.stringify(json, null, 2))
        } else {
          console.log("Fail body:", await res.text())
        }
      } catch (e) {
        console.log("Error:", e.message)
      }
    }
  }
}

probe()
