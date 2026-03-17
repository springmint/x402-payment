# Agent Guidelines: x402-skill

Guidelines for AI agents working with this repository.

---

## Repository Structure

```
x402-payment/                    # repo root = npm package
├── README.md                    # Project overview
├── LICENSE                      # MIT License
├── CONTRIBUTING.md              # Contribution guidelines
├── AGENTS.md                    # This file
├── package.json                 # @springmint/x402-payment
├── SKILL.md                     # AI Agent instruction file
├── tsconfig.json
├── src/
│   ├── index.ts                 # Library exports
│   ├── config.ts                # Key discovery (findPrivateKey, findApiKey)
│   ├── client.ts                # Client factory (createX402Client, createX402FetchClient, invokeEndpoint)
│   └── cli.ts                   # CLI entry point
└── dist/
    ├── lib/                     # Library build (importable via npm)
    └── cli/
        └── x402_invoke.js       # Bundled CLI executable
```

---

## What is a Skill?

A **skill** is a document that teaches AI agents how to accomplish specific tasks. The core file is `SKILL.md` — it contains step-by-step instructions the agent follows to complete a task.

---

## How to Use

### As a Library (for developing new skills)

```ts
import { createX402FetchClient, invokeEndpoint } from "@springmint/x402-payment";

const client = await createX402FetchClient();
const response = await client.request("https://paid-api.com/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "hello" }),
});
```

### As a CLI (for AI agents)

1. Read `SKILL.md` for the full instruction set
2. Use the `x402_invoke` tool as described in SKILL.md
3. Private keys are loaded from environment variables — never output them

---

## Creating a New Skill with x402 Payment

When creating a skill that uses x402 payment, declare `@springmint/x402-payment` as a dependency:

### Option A: Library integration (recommended)

```ts
// your-skill/src/index.ts
import { createX402FetchClient } from "@springmint/x402-payment";

const client = await createX402FetchClient();
// Use client.request() to call your paid endpoints
```

### Option B: SKILL.md dependency declaration

```markdown
---
name: my-skill
description: Brief description
version: 1.0.0
dependencies:
  - x402-payment
---

# My Skill

## Prerequisites
- Install x402-payment: `npm install @springmint/x402-payment`

## Usage
[Step-by-step guide using x402_invoke CLI or library API]
```

---

## Security Rules

- Never hardcode private keys in examples or scripts
- Use environment variables for all sensitive data
- Sanitize error messages to prevent key leaks
- Warn about testnet vs mainnet usage

---

**Maintainer**: Springmint
