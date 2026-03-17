import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Search for a private key from environment variables, config files, and mcporter config.
 *
 * Lookup order:
 * 1. Environment variables (TRON_PRIVATE_KEY / EVM_PRIVATE_KEY / ETH_PRIVATE_KEY / PRIVATE_KEY)
 * 2. Local config files (./x402-config.json, ~/.x402-config.json)
 * 3. mcporter config (~/.mcporter/mcporter.json)
 */
export async function findPrivateKey(type: "tron" | "evm"): Promise<string | undefined> {
  // 1. Check environment variables
  if (type === "tron") {
    if (process.env.TRON_PRIVATE_KEY) return process.env.TRON_PRIVATE_KEY;
  } else {
    if (process.env.EVM_PRIVATE_KEY) return process.env.EVM_PRIVATE_KEY;
    if (process.env.ETH_PRIVATE_KEY) return process.env.ETH_PRIVATE_KEY;
  }
  if (process.env.PRIVATE_KEY) return process.env.PRIVATE_KEY;

  // 2. Check local config files
  const configFiles = [path.join(process.cwd(), "x402-config.json"), path.join(os.homedir(), ".x402-config.json")];

  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      try {
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        if (type === "tron") {
          const key = config.tron_private_key || config.private_key;
          if (key) return key;
        } else {
          const key = config.evm_private_key || config.eth_private_key || config.private_key;
          if (key) return key;
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  // 3. Check mcporter config
  const mcporterPath = path.join(os.homedir(), ".mcporter", "mcporter.json");
  if (fs.existsSync(mcporterPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(mcporterPath, "utf8"));
      if (config.mcpServers) {
        for (const serverName in config.mcpServers) {
          const s = config.mcpServers[serverName];
          if (type === "tron" && s?.env?.TRON_PRIVATE_KEY) return s.env.TRON_PRIVATE_KEY;
          if (type === "evm" && (s?.env?.EVM_PRIVATE_KEY || s?.env?.ETH_PRIVATE_KEY)) {
            return s.env.EVM_PRIVATE_KEY || s.env.ETH_PRIVATE_KEY;
          }
          if (s?.env?.PRIVATE_KEY) return s.env.PRIVATE_KEY;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  return undefined;
}

/**
 * Search for TronGrid API key from environment variables, config files, and mcporter config.
 */
export async function findApiKey(): Promise<string | undefined> {
  if (process.env.TRON_GRID_API_KEY) return process.env.TRON_GRID_API_KEY;

  const configFiles = [path.join(process.cwd(), "x402-config.json"), path.join(os.homedir(), ".x402-config.json")];

  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      try {
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        const key = config.tron_grid_api_key || config.api_key;
        if (key) return key;
      } catch (e) {
        /* ignore */
      }
    }
  }

  const mcporterPath = path.join(os.homedir(), ".mcporter", "mcporter.json");
  if (fs.existsSync(mcporterPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(mcporterPath, "utf8"));
      if (config.mcpServers) {
        for (const serverName in config.mcpServers) {
          const s = config.mcpServers[serverName];
          if (s?.env?.TRON_GRID_API_KEY) return s.env.TRON_GRID_API_KEY;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }
  return undefined;
}
