import { authorizeUsageToken, setUsageToken } from "./providers/copilot"
import { providers } from "./providers"
import { getAuthFilePath } from "./utils/paths"

async function test() {
  console.log("Starting device flow for GitHub usage token...")
  console.log("This will require you to authorize in your browser.\n")

  const token = await authorizeUsageToken({
    onDeviceCode: (userCode, verificationUri) => {
      console.log("=".repeat(50))
      console.log("GO TO:", verificationUri)
      console.log("ENTER CODE:", userCode)
      console.log("=".repeat(50))
      console.log("\nWaiting for authorization...")
    },
    onSuccess: () => {
      console.log("\n✅ Authorization successful!")
    },
    onError: (error) => {
      console.log("\n❌ Error:", error)
    },
  })

  if (!token) {
    console.log("Failed to get token")
    return
  }

  console.log("\nUsage token obtained:", token.slice(0, 20) + "...")

  // Now test fetching usage with this token
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const auth = auths["github-copilot"]

  if (!auth) {
    console.log("No github-copilot auth found")
    return
  }

  setUsageToken(token)

  console.log("\nFetching usage data...")
  const provider = providers["github-copilot"]
  const snapshot = await provider.fetchUsage!(auth)

  console.log("\n" + "=".repeat(50))
  console.log("USAGE SNAPSHOT:")
  console.log(JSON.stringify(snapshot, null, 2))

  if (snapshot?.quota) {
    const q = snapshot.quota
    console.log("\n" + "=".repeat(50))
    console.log("PARSED USAGE:")
    if (q.chat !== null) {
      console.log(`Chat: ${q.chat}/${q.chatLimit} remaining`)
    } else {
      console.log(`Chat Limit: ${q.chatLimit} (actual usage unknown)`)
    }
    if (q.completions !== null) {
      console.log(`Completions: ${q.completions}/${q.completionsLimit} remaining`)
    } else {
      console.log(`Completions Limit: ${q.completionsLimit} (actual usage unknown)`)
    }
  }

  // Save the token for future use
  const tokenPath = authPath.replace("auth.json", "copilot-usage-token.json")
  await Bun.write(tokenPath, JSON.stringify({ token, savedAt: Date.now() }))
  console.log(`\nToken saved to: ${tokenPath}`)
}

test()
