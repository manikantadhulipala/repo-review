# repo-review

> The finished project for **[Vercel Sandbox](https://vercel.com/academy/vercel-sandbox)** on Vercel Academy, built lesson by lesson from [lesson 1.1, Your First Sandbox](https://vercel.com/academy/vercel-sandbox/your-first-sandbox).

## Run it locally

### Prerequisites

- Node.js 22.12 or later
- pnpm, to match the `pnpm-lock.yaml` in this folder
- A Vercel account and the [Vercel CLI](https://vercel.com/docs/cli)

### Environment variables

Run `vercel link`, then `vercel env pull .env`. That writes the variables to `.env`, which the scripts load. `.env.example` lists them:

- `VERCEL_OIDC_TOKEN`: written by `vercel env pull`. It authenticates both Vercel Sandbox and AI Gateway. It expires after about 12 hours, so pull again if Sandbox calls start failing with an auth error.
- `REVIEW_MODEL`: the AI Gateway model for the review, for example `openai/gpt-4o-mini`. Without it, the AI step is skipped with a warning.
- `AI_GATEWAY_API_KEY` (optional): an AI Gateway API key to use instead of the OIDC token for model calls.
- `SANDBOX_SNAPSHOT_ID` (optional): a snapshot to restore for faster Sandbox cold starts. [Lesson 5.2](https://vercel.com/academy/vercel-sandbox/sandbox-snapshots-for-speed) creates one.

### Commands

```bash
pnpm install
pnpm type-check
pnpm review https://github.com/<owner>/<repo>
```

`review` takes a public GitHub URL. It exits 0 when the review runs, 1 when it can't (for example, a private or missing repo), and 2 for an invalid URL.

## What it does

A CLI named `repo-review` that takes a GitHub URL, clones the repo into an isolated Vercel Sandbox, runs the test suite, generates a structured AI review through the configured model gateway, and prints a severity-sorted combined report.

`src/` contains:

- `sandbox-lifecycle.ts`: Sandbox creation, clone, file collection, test run
- `cli.ts`: `commander` setup, URL validation, pipeline orchestration
- `analyze.ts`: Zod-backed structured AI review with `generateText` and `Output.object`
- `test-runner.ts`: failure parser and package-manager detection
- `reporter.ts`: severity-sorted, CI-aware output

## Tech stack

- [`@vercel/sandbox`](https://vercel.com/docs/sandbox)
- A model gateway for AI review (configured through environment variables)
- [`commander`](https://github.com/tj/commander.js)
- [`zod`](https://zod.dev/)
- TypeScript 5, `tsx`, `pnpm`
