#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findPrivateKey, findApiKey } from "./config.js";
import { createX402FetchClient, checkAllowance, approveToken } from "./client.js";

async function main() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        options[key] = value;
        i++;
      } else {
        options[key] = "true";
      }
    }
  }

  const url = options.url;
  const entrypoint = options.entrypoint;
  const inputRaw = options.input;
  const methodArg = options.method;

  const tronKey = await findPrivateKey("tron");
  const evmKey = await findPrivateKey("evm");
  const apiKey = await findApiKey();

  if (options.check === "true" || options.status === "true") {
    const { TronClientSigner, EvmClientSigner } = await import("@springmint/x402");
    if (tronKey) {
      const signer = new TronClientSigner(tronKey);
      console.error(`[OK] TRON Wallet: ${signer.getAddress()}`);
      if (apiKey) console.error(`[OK] TRON_GRID_API_KEY is configured.`);
    }
    if (evmKey) {
      const signer = new EvmClientSigner(evmKey);
      console.error(`[OK] EVM Wallet: ${signer.getAddress()}`);
    }
    if (!tronKey && !evmKey) {
      console.error("[WARN] No private keys found. Configure TRON_PRIVATE_KEY or EVM_PRIVATE_KEY.");
    }
    process.exit(0);
  }

  // --allowance --token <address> --network <network> [--type evm|tron]
  if (options.allowance === "true") {
    const token = options.token;
    const network = options.network;
    const type = (options.type || "evm") as "tron" | "evm";
    if (!token || !network) {
      console.error("Error: --allowance requires --token and --network");
      process.exit(1);
    }
    try {
      const allowance = await checkAllowance(type, token, network, {
        tronPrivateKey: tronKey,
        evmPrivateKey: evmKey,
        tronGridApiKey: apiKey,
      });
      process.stdout.write(JSON.stringify({ allowance: allowance.toString() }, null, 2) + "\n");
    } catch (e: any) {
      console.error(`[x402] Error: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // --approve --token <address> --network <network> [--type evm|tron]
  if (options.approve === "true") {
    const token = options.token;
    const network = options.network;
    const type = (options.type || "evm") as "tron" | "evm";
    if (!token || !network) {
      console.error("Error: --approve requires --token and --network");
      process.exit(1);
    }
    try {
      console.error(`[x402] Approving ${token} on ${network} (${type})...`);
      const result = await approveToken(type, token, network, {
        tronPrivateKey: tronKey,
        evmPrivateKey: evmKey,
        tronGridApiKey: apiKey,
      });
      console.error(`[x402] Approval ${result ? "successful" : "not needed (already approved)"}.`);
      process.stdout.write(JSON.stringify({ approved: result }, null, 2) + "\n");
    } catch (e: any) {
      console.error(`[x402] Error: ${e.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (!url) {
    console.error("Error: --url is required");
    process.exit(1);
  }

  // Redirect console.log to console.error to prevent library pollution of STDOUT
  console.log = console.error;

  let finalUrl = url;
  let finalMethod = methodArg || "GET";
  let finalBody: string | undefined = undefined;

  if (entrypoint) {
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    finalUrl = `${baseUrl}/entrypoints/${entrypoint}/invoke`;
    finalMethod = "POST";
    let inputData = {};
    if (inputRaw) {
      try {
        inputData = JSON.parse(inputRaw);
      } catch (e) {
        inputData = inputRaw;
      }
    }
    finalBody = JSON.stringify({ input: inputData });
  } else {
    if (methodArg) finalMethod = methodArg.toUpperCase();
    if (inputRaw) finalBody = inputRaw;
  }

  try {
    const fetchClient = await createX402FetchClient({
      tronPrivateKey: tronKey,
      evmPrivateKey: evmKey,
      tronGridApiKey: apiKey,
    });

    const requestInit: any = {
      method: finalMethod,
      headers: { "Content-Type": "application/json" },
      body: finalBody,
    };

    console.error(`[x402] Requesting: ${finalMethod} ${finalUrl}`);
    const response = await fetchClient.request(finalUrl, requestInit);

    const contentType = response.headers.get("content-type") || "";
    let responseBody;

    if (contentType.includes("application/json")) {
      responseBody = await response.json();
    } else if (contentType.includes("image/") || contentType.includes("application/octet-stream")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const tmpDir = os.tmpdir();
      const isImage = contentType.includes("image/");
      const ext = isImage ? contentType.split("/")[1]?.split(";")[0] || "bin" : "bin";
      const fileName = `x402_${isImage ? "image" : "binary"}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = path.join(tmpDir, fileName);

      fs.writeFileSync(filePath, buffer);
      console.error(`[x402] Binary data saved to: ${filePath}`);
      responseBody = { file_path: filePath, content_type: contentType, bytes: buffer.length };
    } else {
      responseBody = await response.text();
    }

    process.stdout.write(
      JSON.stringify(
        {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        },
        null,
        2,
      ) + "\n",
    );
  } catch (error: any) {
    let message = error.message || "Unknown error";
    let stack = error.stack || "";

    // Sanitize any potential private key leaks in error messages/stacks
    const keys = [tronKey, evmKey].filter(Boolean) as string[];
    for (const key of keys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const keyRegex = new RegExp(escapedKey, "g");
      message = message.replace(keyRegex, "[REDACTED]");
      stack = stack.replace(keyRegex, "[REDACTED]");
    }

    console.error(`[x402] Error: ${message}`);
    process.stdout.write(
      JSON.stringify(
        {
          error: message,
          stack: stack,
        },
        null,
        2,
      ) + "\n",
    );
    process.exit(1);
  }
}

main();
