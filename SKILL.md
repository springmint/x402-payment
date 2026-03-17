---
name: x402-payment
description: "Pay for x402-enabled Agent endpoints using ERC20 tokens (USDT/USDC) on EVM or TRC20 tokens (USDT/USDD) on TRON."
user-invokable: true
argument-hint: "url(required): Base URL of the agent (v2) or full URL (v1/Discovery); entrypoint(optional): Entrypoint name to invoke (e.g., 'chat', 'search'); input(optional): Input object to send to the entrypoint; method(optional): HTTP method (GET/POST), default POST(v2)/GET(Direct)"
compatibility:
  tools:
    - x402_invoke
metadata:
  version: 1.0.1
  author: cppay.finance
  homepage: https://x402.org
  tags: [crypto, payments, x402, agents, api, usdt, usdd, usdc, tron, ethereum, evm, erc20, trc20, sdk]
  requires_tools: [x402_invoke]
  tool_implementation_mapping:
    x402_invoke: dist/cli/x402_invoke.js
  dependencies:
    - mcp-server-tron
---

# x402 Payment Skill

Invoke x402-enabled AI agent endpoints with automatic token payments on both TRON (TRC20) and EVM-compatible (ERC20) chains.

## Overview

The `x402-payment` package provides two ways to handle x402 payments:

1. **As a library** — other skills and Node.js apps `import` it to gain x402 payment capability
2. **As a CLI tool** — AI agents invoke `x402_invoke` directly from the command line

When an HTTP `402 Payment Required` response is received, the package automatically handles negotiation, signing, and execution of the on-chain payment.

## Prerequisites

1. Install: `npm install @springmint/x402-payment`
2. Configure wallet — see [Wallet Configuration](https://github.com/springmint/x402-payment#wallet-configuration) for all supported methods (environment variables, `x402-config.json`, `~/.mcporter/mcporter.json`)
3. Verify: `npx @springmint/x402-payment --check`

## Usage as a Library

Other skills can add x402 payment capability by importing this package:

```bash
npm install @springmint/x402-payment
```

```ts
import { createX402FetchClient, invokeEndpoint } from "@springmint/x402-payment";

// Option 1: Fetch client with automatic 402 handling
const client = await createX402FetchClient();
const response = await client.request("https://paid-api.com/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
});

// Option 2: High-level invoke helper
const result = await invokeEndpoint("https://api.example.com", {
  entrypoint: "chat",
  input: { prompt: "hello" },
});
```

### Library API

| Function | Description |
|----------|-------------|
| `createX402FetchClient(options?)` | Create a fetch client with automatic 402 payment handling |
| `createX402Client(options?)` | Create the underlying X402Client with payment mechanisms |
| `invokeEndpoint(url, options?)` | High-level: create client, request, return parsed response |
| `findPrivateKey(type)` | Discover private key from env/config files |
| `findApiKey()` | Discover TronGrid API key |

## Usage as CLI (AI Agent)

### 1. Verification

Before making payments, verify your wallet status:

```bash
npx @springmint/x402-payment --check
```

### 2. Invoking an Agent (v2)

Most modern x402 agents use the v2 "invoke" pattern:

```bash
npx @springmint/x402-payment \
  --url https://api.example.com \
  --entrypoint chat \
  --input '{"prompt": "Your query here"}'
```

### 3. Agent Discovery (Direct)

- **Manifest**: Fetch agent metadata.
  ```bash
  npx @springmint/x402-payment --url https://api.example.com/.well-known/agent.json
  ```
- **List Entrypoints**: List available functions.
  ```bash
  npx @springmint/x402-payment --url https://api.example.com/entrypoints
  ```

### 4. Cross-Chain Support

The SDK automatically detects the required chain from the server's 402 response. No need to specify the network manually — it matches the payment requirements with registered mechanisms.

- **TRON (TRC20)**: Requires `TRON_PRIVATE_KEY`
- **EVM (ERC20)**: Requires `EVM_PRIVATE_KEY` or `ETH_PRIVATE_KEY`

## Supported Networks & Tokens

| Chain    | Network Name  | Common Tokens    | USDT Contract                                |
| -------- | ------------- | ---------------- | -------------------------------------------- |
| **TRON** | `mainnet`     | USDT, USDD       | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`         |
| **TRON** | `nile`        | USDT, USDD       | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`         |
| **BSC**  | `bsc`         | USDT, USDC       | `0x55d398326f99059fF775485246999027B3197955` |
| **BSC**  | `bsc-testnet` | USDT, USDC, DHLU | `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` |

## Security Considerations & Rules

> [!CAUTION]
> **Private Key Safety**: NEVER output your private keys to the logs or console. The package loads keys from environment variables internally.

### Agent Security Rules:

- **No Private Key Output**: The Agent MUST NOT print, echo, or output any private key to the dialogue context.
- **Internal Loading Only**: Rely on the tool to load keys internally.
- **No Export Commands**: DO NOT execute shell commands containing the private key as a literal string.
- **Silent Environment Checks**: Use `[[ -n $TRON_PRIVATE_KEY ]] && echo "Configured" || echo "Missing"` to verify configuration without leaking secrets.
- **Use the Check Tool**: Use `x402-payment --check` to safely verify addresses.

## Binary and Image Handling

If the endpoint returns an image or binary data (CLI mode only):

1. The data is saved to a temporary file (e.g., `/tmp/x402_image_...`).
2. The tool returns JSON with `file_path`, `content_type`, and `bytes`.
3. **Important**: The Agent is responsible for deleting the temporary file after use.

## Error Handling

### Insufficient Allowance

If allowance is insufficient, the tool will automatically attempt an "infinite approval" transaction. Ensure you have native tokens (TRX or BNB/ETH) for gas.

### Insufficient Balance

Ensure you have enough USDT/USDC/USDD in your wallet on the specified network.

---

_Last Updated: 2026-03-17_
