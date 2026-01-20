import { getAuthFilePath } from "./utils/paths"

async function debug() {
  const authPath = getAuthFilePath()
  const auths = await Bun.file(authPath).json()
  const copilotAuth = auths["github-copilot"]

  if (copilotAuth && copilotAuth.access) {
    console.log("Token parts:")
    console.log(copilotAuth.access.split(";").join("\n"))
  }
}

debug()
