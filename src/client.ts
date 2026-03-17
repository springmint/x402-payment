import { findPrivateKey, findApiKey } from "./config.js";

export interface CreateClientOptions {
  /** TRON private key. If not provided, will be auto-discovered from env/config files. */
  tronPrivateKey?: string;
  /** EVM private key. If not provided, will be auto-discovered from env/config files. */
  evmPrivateKey?: string;
  /** TronGrid API key. If not provided, will be auto-discovered from env/config files. */
  tronGridApiKey?: string;
  /** Suppress log output. Default: false. */
  silent?: boolean;
}

/**
 * Create a fully configured X402Client with TRON and EVM payment mechanisms registered.
 *
 * Automatically discovers private keys from environment variables, config files,
 * and mcporter config. You can also pass keys explicitly.
 */
export async function createX402Client(options: CreateClientOptions = {}) {
  const {
    TronClientSigner,
    EvmClientSigner,
    X402Client,
    ExactTronClientMechanism,
    ExactEvmClientMechanism,
    ExactPermitTronClientMechanism,
    ExactPermitEvmClientMechanism,
    SufficientBalancePolicy,
  } = await import("@springmint/x402");

  const tronKey = options.tronPrivateKey ?? (await findPrivateKey("tron"));
  const evmKey = options.evmPrivateKey ?? (await findPrivateKey("evm"));
  const apiKey = options.tronGridApiKey ?? (await findApiKey());

  if (apiKey) process.env.TRON_GRID_API_KEY = apiKey;

  const log = options.silent ? () => {} : (...args: any[]) => console.error("[x402]", ...args);

  const client = new X402Client();

  if (tronKey) {
    const signer = new TronClientSigner(tronKey);
    const networks = ["mainnet", "nile", "shasta", "*"];
    for (const net of networks) {
      const networkId = net === "*" ? "tron:*" : `tron:${net}`;
      client.register(networkId, new ExactTronClientMechanism(signer));
      client.register(networkId, new ExactPermitTronClientMechanism(signer));
    }
    log("TRON mechanisms enabled.");
  }

  if (evmKey) {
    const signer = new EvmClientSigner(evmKey);
    client.register("eip155:*", new ExactEvmClientMechanism(signer));
    client.register("eip155:*", new ExactPermitEvmClientMechanism(signer));
    log("EVM mechanisms enabled.");
  }

  client.registerPolicy(new SufficientBalancePolicy(client));

  return client;
}

/**
 * Create a fetch client that automatically handles HTTP 402 Payment Required responses.
 *
 * Usage:
 * ```ts
 * const fetchClient = await createX402FetchClient();
 * const response = await fetchClient.request("https://paid-api.com/endpoint", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ key: "value" }),
 * });
 * ```
 */
export async function createX402FetchClient(options: CreateClientOptions = {}) {
  const { X402FetchClient } = await import("@springmint/x402");
  const client = await createX402Client(options);
  return new X402FetchClient(client);
}

/**
 * High-level helper: invoke an x402-enabled endpoint and return the parsed response.
 *
 * Supports two modes:
 * - **Entrypoint mode**: provide `entrypoint` to call `{url}/entrypoints/{entrypoint}/invoke`
 * - **Direct mode**: omit `entrypoint` to request the URL directly
 *
 * Usage:
 * ```ts
 * // Entrypoint mode
 * const result = await invokeEndpoint("https://api.example.com", {
 *   entrypoint: "chat",
 *   input: { prompt: "hello" },
 * });
 *
 * // Direct mode
 * const result = await invokeEndpoint("https://api.example.com/some/path", {
 *   method: "GET",
 * });
 * ```
 */
export async function invokeEndpoint(
  url: string,
  options: {
    entrypoint?: string;
    input?: any;
    method?: string;
    clientOptions?: CreateClientOptions;
  } = {},
): Promise<{ status: number; headers: Record<string, string>; body: any }> {
  const fetchClient = await createX402FetchClient(options.clientOptions);

  let finalUrl = url;
  let finalMethod = options.method || "GET";
  let finalBody: string | undefined = undefined;

  if (options.entrypoint) {
    const baseUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    finalUrl = `${baseUrl}/entrypoints/${options.entrypoint}/invoke`;
    finalMethod = "POST";
    finalBody = JSON.stringify({ input: options.input ?? {} });
  } else if (options.input) {
    finalBody = typeof options.input === "string" ? options.input : JSON.stringify(options.input);
  }

  const response = await fetchClient.request(finalUrl, {
    method: finalMethod,
    headers: { "Content-Type": "application/json" },
    body: finalBody,
  });

  const contentType = response.headers.get("content-type") || "";
  let body: any;

  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
}

/**
 * Check token allowance for the current wallet.
 *
 * Usage:
 * ```ts
 * const allowance = await checkAllowance("evm", "0x55d3...7955", "eip155:56");
 * console.log(`Current allowance: ${allowance}`);
 * ```
 */
export async function checkAllowance(
  type: "tron" | "evm",
  token: string,
  network: string,
  options: CreateClientOptions = {},
): Promise<bigint> {
  const { TronClientSigner, EvmClientSigner } = await import("@springmint/x402");

  const key = type === "tron"
    ? (options.tronPrivateKey ?? await findPrivateKey("tron"))
    : (options.evmPrivateKey ?? await findPrivateKey("evm"));

  if (!key) throw new Error(`No ${type.toUpperCase()} private key found.`);

  const apiKey = options.tronGridApiKey ?? (await findApiKey());
  if (apiKey) process.env.TRON_GRID_API_KEY = apiKey;

  const signer = type === "tron" ? new TronClientSigner(key) : new EvmClientSigner(key);
  return signer.checkAllowance(token, BigInt(0), network);
}

/**
 * Approve token spending for x402 payments. Calls `ensureAllowance` on the signer.
 *
 * Usage:
 * ```ts
 * await approveToken("evm", "0x55d3...7955", "eip155:56");
 * ```
 */
export async function approveToken(
  type: "tron" | "evm",
  token: string,
  network: string,
  options: CreateClientOptions = {},
): Promise<boolean> {
  const { TronClientSigner, EvmClientSigner } = await import("@springmint/x402");

  const key = type === "tron"
    ? (options.tronPrivateKey ?? await findPrivateKey("tron"))
    : (options.evmPrivateKey ?? await findPrivateKey("evm"));

  if (!key) throw new Error(`No ${type.toUpperCase()} private key found.`);

  const apiKey = options.tronGridApiKey ?? (await findApiKey());
  if (apiKey) process.env.TRON_GRID_API_KEY = apiKey;

  const signer = type === "tron" ? new TronClientSigner(key) : new EvmClientSigner(key);
  // Use max uint256 for unlimited approval
  const maxAmount = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  return signer.ensureAllowance(token, maxAmount, network, "auto");
}
