# Repository Guidelines

## Project Structure & Module Organization
- `packages/cli`: CLI UI and entrypoint (source under `src/`).
- `packages/core`: Core engine and shared logic.
- `packages/test-utils`: Helpers for tests.
- `packages/vscode-ide-companion`: VS Code integration.
- `integration-tests`: End‑to‑end tests (Vitest).
- `scripts`: Build, sandbox, release, and tooling scripts.
- `docs`: Product docs and assets (`docs/assets/`).
- `bundle/`: Built CLI artifact (`gemini` runs `bundle/gemini.js`).

## Build, Test, and Development Commands
- `npm install`: Install root + workspace deps (Node 20+; see `.nvmrc`).
- `npm run build`: Build all packages (TypeScript → JS, bundle assets).
- `npm start`: Run the CLI from source.
- `npm run build:all`: Build CLI and sandbox image (see Sandboxing docs).
- `npm run test`: Run unit tests across workspaces (Vitest).
- `npm run test:e2e`: Run integration tests in `integration-tests/`.
- `npm run preflight`: Full check (format, lint, build, typecheck, tests).
- `npm run lint | lint:fix | format | typecheck`: Lint/format/type checks.

## Coding Style & Naming Conventions
- Indentation: 2 spaces, LF; max line width 80 (`.editorconfig`).
- Prettier: semicolons, single quotes, trailing commas (`.prettierrc.json`).
- ESLint: TypeScript + import rules; license header enforced.
- TypeScript: strict mode, ESM (`module: NodeNext`). Avoid `any`; prefer `unknown` with narrowing. Keep modules small and exported APIs clear.
- Flags and file names: use hyphenated flags (e.g., `--dry-run`). Tests named `*.test.ts[x]`.

## Testing Guidelines
- Framework: Vitest. Co‑locate unit tests near source in `packages/*/src`.
- Integration tests live in `integration-tests/` with its own config.
- Common pattern: `describe/it/expect`, use `vi.mock` for Node built‑ins and external SDKs when needed.
- Run locally: `npm run test` (unit) and `npm run test:e2e` (E2E). For full CI parity, use `npm run preflight`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: e.g., `feat(cli): add --json output`.
- Link issues in the PR description (e.g., `Fixes #123`).
- Keep PRs small and focused; update relevant docs under `docs/`.
- Ensure all checks pass locally: `npm run preflight` before pushing.
- Include usage notes or terminal snippets when behavior changes.

## Security & Configuration Tips
- Prefer sandboxed runs for risky operations: `npm run build:all` then `npm start` (set `GEMINI_SANDBOX=true|docker|podman`).
- Auth and environment configuration are described in `docs/cli/authentication.md` and `README.md`.

