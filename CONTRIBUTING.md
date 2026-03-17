# Contributing to x402-skill

Thanks for your interest in contributing!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Make your changes
4. Test with an AI agent to ensure the skill works correctly
5. Submit a pull request

## Development

```bash
cd x402-payment

# Install dependencies
yarn install

# Build library (TypeScript → dist/lib/)
yarn build:lib

# Build CLI (bundled → dist/cli/x402_invoke.js)
yarn build:cli

# Build both
yarn build
```

## Skill Guidelines

- **SKILL.md** is the main instruction file — keep it clear and actionable
- Include complete examples with all parameters
- Document error cases and how to handle them
- Never hardcode private keys or secrets
- Test on both TRON and EVM networks if applicable

## Using x402-payment in Your Skill

If your skill needs x402 payment, add it as a dependency:

```bash
npm install @springmint/x402-payment
```

```ts
import { createX402FetchClient } from "@springmint/x402-payment";

const client = await createX402FetchClient();
const res = await client.request("https://your-paid-api.com/endpoint", { method: "GET" });
```

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Network and token details (if relevant)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
