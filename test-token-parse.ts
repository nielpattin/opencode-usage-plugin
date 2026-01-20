import { getAuthFilePath } from "./utils/paths"
import { providers } from "./providers"

async function test() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]

  if (!auth) {
    console.log("No github-copilot auth found")
    return
  }

  console.log("Access token (first 100 chars):", auth.access?.slice(0, 100))
  console.log("\nParsed token parts:")
  const parts = (auth.access || "").split(";")
  for (const part of parts) {
    const [key, val] = part.split("=")
    if (["sku", "cq", "rd", "chat", "exp"].includes(key)) {
      console.log(`  ${key}: ${val}`)
    }
  }

  console.log("\n--- Fetching usage via provider ---")
  const provider = providers["github-copilot"]
  const snapshot = await provider.fetchUsage!(auth)
  
  console.log("\nSnapshot:")
  console.log(JSON.stringify(snapshot, null, 2))

  if (snapshot?.planType) {
    console.log("\n✅ Plan Type:", snapshot.planType)
  }
  if (snapshot?.credits?.balance) {
    console.log("✅ Quota Balance:", snapshot.credits.balance)
  }
  if (snapshot?.quota?.completions) {
    console.log("✅ Completions Limit:", snapshot.quota.completions)
  }
  if (snapshot?.quota?.resetAt) {
    const resetDate = new Date(snapshot.quota.resetAt * 1000)
    console.log("✅ Reset Date:", resetDate.toISOString())
  }
}

test()
