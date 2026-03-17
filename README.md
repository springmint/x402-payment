# @springmint/x402-payment

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@springmint/x402-payment)](https://www.npmjs.com/package/@springmint/x402-payment)

Add **pay-per-use** capability to your AI agent skills and Node.js applications with the [x402 protocol](https://x402.org).

## What is x402?

x402 is a payment protocol built on HTTP status code **402 Payment Required**. When you call an x402-enabled API without paying, the server returns a `402` response with payment requirements. This SDK handles the entire payment flow automatically:

```
Your App                          Paid API Server
  │                                     │
  │──── GET /api/data ─────────────────>│
  │<─── 402 Payment Required ───────────│  (includes: price, token, chain, payTo)
  │                                     │
  │  [SDK auto-signs & pays on-chain]   │
  │                                     │
  │──── GET /api/data + payment proof ─>│
  │<─── 200 OK + data ─────────────────│
  └─────────────────────────────────────┘
```

**You don't need to handle any of this yourself.** Just use `createX402FetchClient()` and call your API like normal — the SDK intercepts 402 responses, pays on-chain, and retries automatically.

## Install

```bash
npm install @springmint/x402-payment
```

## Wallet Configuration

The SDK needs a private key to sign on-chain payments. It searches in this order:

| Priority | Source | Keys |
|----------|--------|------|
| 1 | Environment variables | `TRON_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `ETH_PRIVATE_KEY`, `PRIVATE_KEY` |
| 2 | Project config | `./x402-config.json` |
| 3 | User config | `~/.x402-config.json` |
| 4 | mcporter config | `~/.mcporter/mcporter.json` |

Quickest way:

```bash
# For EVM chains (BSC, Ethereum, Base, etc.)
export EVM_PRIVATE_KEY=your_private_key_hex

# For TRON
export TRON_PRIVATE_KEY=your_private_key_hex

# Verify
npx @springmint/x402-payment --check
# [OK] EVM Wallet: 0x1234...abcd
# [OK] TRON Wallet: TXyz...
```

Or use a config file:

```json
// x402-config.json
{
  "evm_private_key": "your_evm_key",
  "tron_private_key": "your_tron_key",
  "tron_grid_api_key": "your_trongrid_key"
}
```

## Usage

### As a Library

Import the SDK in your skill or Node.js application to call paid APIs:

```ts
import { createX402FetchClient } from "@springmint/x402-payment";

// Create a client — keys are auto-discovered
const client = await createX402FetchClient();

// Use it like a normal fetch — 402 payments are handled automatically
const response = await client.request(
  "https://www.cpbox.io/api/rpc/x402/batch-balance",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chain: "ethereum",
      token: "",
      addresses: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    }),
  },
);

const data = await response.json();
console.log(data);
```

For the common pattern of calling an x402 agent's entrypoint, use the high-level helper:

```ts
import { invokeEndpoint } from "@springmint/x402-payment";

// Entrypoint mode — automatically calls POST {url}/entrypoints/{name}/invoke
const result = await invokeEndpoint("https://api.example.com", {
  entrypoint: "chat",
  input: { prompt: "hello" },
});
console.log(result.status); // 200
console.log(result.body);   // { response: "..." }
```

You can also pass keys explicitly instead of relying on auto-discovery:

```ts
const client = await createX402FetchClient({
  evmPrivateKey: "0x...",
  tronPrivateKey: "...",
  silent: true, // suppress [x402] log output
});
```

### As a CLI

AI agents and command-line users can invoke paid APIs directly:

```bash
# Call an agent's entrypoint
npx @springmint/x402-payment \
  --url https://api.example.com \
  --entrypoint chat \
  --input '{"prompt": "hello"}'

# Call a URL directly
npx @springmint/x402-payment \
  --url https://www.cpbox.io/api/rpc/x402/batch-balance \
  --method POST \
  --input '{"chain":"ethereum","token":"","addresses":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]}'
```

#### CLI Options

| Option | Required | Description |
|--------|----------|-------------|
| `--url` | Yes | Target API endpoint URL |
| `--entrypoint` | No | Entrypoint name (constructs `/entrypoints/{name}/invoke` URL, forces POST) |
| `--input` | No | JSON request body |
| `--method` | No | HTTP method (default: GET for direct, POST for entrypoint) |
| `--check` | No | Verify wallet configuration and exit |
| `--approve` | No | Approve token spending (requires `--token` and `--network`) |
| `--allowance` | No | Check current token allowance (requires `--token` and `--network`) |
| `--token` | No | Token contract address (used with `--approve` / `--allowance`) |
| `--network` | No | Network identifier, e.g. `eip155:97`, `tron:nile` (used with `--approve` / `--allowance`) |
| `--type` | No | Chain type: `evm` (default) or `tron` (used with `--approve` / `--allowance`) |

Output goes to **stdout** as JSON. Logs go to **stderr**.

**Token approval examples:**

```bash
# Check USDT allowance on BSC testnet
npx @springmint/x402-payment --allowance --token 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd --network eip155:97

# Approve USDT on BSC testnet
npx @springmint/x402-payment --approve --token 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd --network eip155:97

# Approve USDT on TRON nile
npx @springmint/x402-payment --approve --token TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf --network tron:nile --type tron
```

## API Reference

### `createX402FetchClient(options?)`

Create a fetch client that automatically handles 402 payment flows.

Returns an `X402FetchClient` instance. Use `client.request(url, init)` to make requests — the same interface as `fetch()`.

### `createX402Client(options?)`

Create the underlying `X402Client` with all payment mechanisms registered. Use this when you need lower-level control over payment mechanisms and policies.

### `invokeEndpoint(url, options?)`

High-level helper that creates a client, sends the request, and returns the parsed response.

```ts
const result = await invokeEndpoint(url, {
  entrypoint?: string,       // entrypoint name (switches to invoke mode)
  input?: any,               // request body (auto-serialized to JSON)
  method?: string,           // HTTP method
  clientOptions?: {          // passed to createX402FetchClient
    tronPrivateKey?: string,
    evmPrivateKey?: string,
    tronGridApiKey?: string,
    silent?: boolean,
  },
});
// result: { status: number, headers: Record<string, string>, body: any }
```

### `findPrivateKey(type: "tron" | "evm")`

Search for a private key following the lookup order described in [Wallet Configuration](#wallet-configuration).

### `findApiKey()`

Search for TronGrid API key using the same lookup order.

### `checkAllowance(type, token, network, options?)`

Check current token allowance for the wallet.

```ts
const allowance = await checkAllowance("evm", "0x55d3...7955", "eip155:56");
console.log(`Allowance: ${allowance}`);
```

### `approveToken(type, token, network, options?)`

Approve unlimited token spending for x402 payments.

```ts
await approveToken("evm", "0x55d3...7955", "eip155:56");
```

## Supported Networks & Tokens

| Chain    | Network       | Tokens           | Example USDT Contract |
|----------|---------------|------------------|-----------------------|
| **TRON** | `mainnet`     | USDT, USDD       | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| **TRON** | `nile`        | USDT, USDD       | `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf` |
| **BSC**  | `bsc`         | USDT, USDC       | `0x55d398326f99059fF775485246999027B3197955` |
| **BSC**  | `bsc-testnet` | USDT, USDC, DHLU | `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd` |

Both **direct transfer** and **permit-based** payment mechanisms are supported on all chains.

## Create Your Own Skill with x402 Payment

If you have a paid API protected by x402, you can create a skill file so AI agents can call it automatically.

### Step 1: Create SKILL.md

Create a `SKILL.md` file for your API:

```markdown
---
name: my-api-skill
description: "Description of your API and when to use it."
version: 1.0.0
dependencies:
  - "@springmint/x402-payment"
---

# My API Skill

> **Prerequisites**: Install and configure `@springmint/x402-payment`.
> See [wallet configuration](https://github.com/springmint/x402-payment#wallet-configuration).
>
> ```bash
> npm install @springmint/x402-payment
> npx @springmint/x402-payment --check
> ```

## Endpoint

\`\`\`
POST https://your-api.com/api/your-endpoint
Content-Type: application/json
\`\`\`

## Using with x402-payment

### CLI (AI Agent)

\`\`\`bash
npx @springmint/x402-payment \
  --url https://your-api.com/api/your-endpoint \
  --method POST \
  --input '{"key": "value"}'
\`\`\`

### Library (Node.js)

\`\`\`ts
import { createX402FetchClient } from "@springmint/x402-payment";

const client = await createX402FetchClient();
const response = await client.request("https://your-api.com/api/your-endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" }),
});
const data = await response.json();
\`\`\`

## Request / Response

[Document your API parameters and response format here]

## Error Handling

### Insufficient Allowance

\`\`\`bash
npx @springmint/x402-payment --approve --token <TOKEN_ADDRESS> --network <NETWORK>
\`\`\`
```

### Step 2: Agent Workflow

When an AI agent receives your skill, the complete flow is:

```
1. Agent reads SKILL.md
       │
2. Checks if @springmint/x402-payment is installed
   └─ If not: runs `npm install @springmint/x402-payment`
       │
3. Verifies wallet: `npx @springmint/x402-payment --check`
   └─ If no wallet: asks user to configure private key
       │
4. Calls your API via CLI or library
       │
5. Gets 402 → SDK auto-pays → gets result
       │
6. If allowance error: runs --approve, then retries
```

### Step 3: Publish

Put your `SKILL.md` in a git repository. AI agents can use it by reading the file:

```
Read my-api-skill/SKILL.md and call the API with {"key": "value"}
```

See [cpbox-skills/batch-balance](https://github.com/springmint/cpbox-skills) for a real-world example.

## Security

- Private keys are **never** output to stdout or logs
- Error messages are automatically sanitized to redact any leaked key material
- `console.log` is redirected to `stderr` in CLI mode to prevent library output from polluting your data pipeline
- Always use testnet (`nile`, `bsc-testnet`) for development

## Project Structure

```
x402-payment/
├── README.md
├── LICENSE
├── package.json              # @springmint/x402-payment
├── SKILL.md                  # AI Agent instruction file
├── src/
│   ├── index.ts              # Library exports
│   ├── config.ts             # Key discovery
│   ├── client.ts             # Client factory & invokeEndpoint
│   └── cli.ts                # CLI entry point
└── dist/
    ├── lib/                  # Library build (import)
    └── cli/                  # CLI build (npx / bin)
```

## License

[MIT](LICENSE)
