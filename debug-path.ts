import { homedir, platform } from "os";
import { join } from "path";
import { existsSync } from "fs";

export function getAppDataPath(): string {
  const plat = platform();
  const home = homedir();
  if (plat === "darwin") return join(home, "Library", "Application Support", "opencode");
  if (plat === "win32") return join(process.env.APPDATA || join(home, "AppData", "Roaming"), "opencode");
  const xdgData = process.env.XDG_DATA_HOME;
  if (xdgData) return join(xdgData, "opencode");
  return join(home, ".local", "share", "opencode");
}

export function getQuotaConfigPath(): string {
  const home = homedir();
  return join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "opencode", "copilot-quota-token.json");
}

const appData = getAppDataPath();
const usageToken = join(appData, "copilot-usage-token.json");
const authJson = join(appData, "auth.json");
const quotaConfig = getQuotaConfigPath();

console.log("OS Platform:", platform());
console.log("XDG_DATA_HOME:", process.env.XDG_DATA_HOME || "not set");
console.log("XDG_CONFIG_HOME:", process.env.XDG_CONFIG_HOME || "not set");
console.log("AppData Path:", appData);
console.log("Auth JSON Path:", authJson, "Exists:", existsSync(authJson));
console.log("Usage Token Path:", usageToken, "Exists:", existsSync(usageToken));
console.log("Quota Config Path:", quotaConfig, "Exists:", existsSync(quotaConfig));
