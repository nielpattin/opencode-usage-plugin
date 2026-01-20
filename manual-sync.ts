import { providers } from "./providers/index"
import { UsageStorage } from "./storage"
import { getAuthFilePath } from "./utils/paths"
import { join } from "path"

async function run() {
  const dbPath = join(process.cwd(), ".opencode/plugin/usage/usage.sqlite")
  const storage = new UsageStorage(dbPath)

  const authPath = getAuthFilePath()
  console.log("Reading auth from:", authPath)

  const auths = await Bun.file(authPath)
    .json()
    .catch((e) => {
      console.error("Failed to read auth file:", e)
      return {}
    })

  console.log("Auth keys found:", Object.keys(auths))

  for (const [providerId, auth] of Object.entries(auths)) {
    let targetId = providerId
    if (providerId === "openai" || providerId === "codex") targetId = "codex"
    if (providerId === "github-copilot" || providerId === "copilot") targetId = "github-copilot"

    console.log(`Processing ${providerId} -> ${targetId}`)

    const provider = providers[targetId]
    if (provider && provider.fetchUsage) {
      try {
        console.log(`Fetching usage for ${targetId}...`)
        const snapshot = await provider.fetchUsage(auth)
        if (snapshot) {
          console.log(`Got snapshot for ${targetId}, saving...`)
          storage.addSnapshot(snapshot)
          console.log("Saved.")
        } else {
          console.log(`No snapshot returned for ${targetId}`)
        }
      } catch (e) {
        console.error(`Error fetching ${targetId}:`, e)
      }
    } else {
      console.log(`No provider/fetchUsage found for ${targetId}`)
    }
  }
}

run()
