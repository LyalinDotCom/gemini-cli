# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Build and Development Commands

### Essential Development Commands

```bash
# Install dependencies
npm install

# Full preflight check (ALWAYS run before submitting changes)
npm run preflight

# Individual build and check commands
npm run build          # Build main project
npm run build:all      # Build main project, sandbox, and vscode extension
npm run test           # Run tests
npm run test:ci        # Run CI tests (includes script tests)
npm run lint           # Lint code
npm run lint:fix       # Fix linting issues
npm run format         # Format code with Prettier
npm run typecheck      # Run TypeScript type checking

# Running the CLI
npm run start          # Start Gemini CLI
npm run debug          # Start in debug mode with Node inspector

# Integration and E2E tests
npm run test:e2e       # Run end-to-end tests
npm run test:integration:all  # Run all integration tests with different sandbox modes
```

### Testing Individual Components

```bash
# Run tests for specific packages
npm run test --workspace=packages/cli
npm run test --workspace=packages/core

# Run specific test files
npx vitest run packages/cli/src/commands/mcp.test.ts
npx vitest run packages/core/src/tools/edit.test.ts
```

## Architecture Overview

The Gemini CLI follows a modular, two-package architecture designed for
extensibility and separation of concerns:

### Package Structure

- **`packages/cli/`**: User-facing interface layer
  - Handles terminal UI rendering using React with Ink
  - Manages user input, history, and commands
  - Implements theming and display formatting
  - Contains all `/slash` commands and UI components

- **`packages/core/`**: Backend processing layer
  - Manages Gemini API communication
  - Handles tool registration and execution
  - Implements authentication (OAuth, API keys, Vertex AI)
  - Contains all tool implementations in `src/tools/`
  - Manages MCP (Model Context Protocol) integration

- **`packages/vscode-ide-companion/`**: VS Code extension
  - Provides IDE integration capabilities
  - Manages open files and diff operations

### Key Architectural Patterns

1. **Tool System**: Tools extend Gemini's capabilities to interact with the
   local environment. Each tool:
   - Implements a specific interface with `execute()` method
   - Declares capabilities (e.g., `modifiesFileSystem`)
   - Returns structured results for the model
   - Located in `packages/core/src/tools/`

2. **Command System**: Slash commands provide user interface actions:
   - Defined in `packages/cli/src/ui/commands/`
   - Registered through `CommandService`
   - Can be extended via custom extensions

3. **Authentication Flow**: Supports multiple auth methods:
   - OAuth flow with Google accounts (Code Assist)
   - Gemini API keys
   - Vertex AI credentials
   - Managed in `packages/core/src/code_assist/`

4. **MCP Integration**: Extensible through Model Context Protocol servers:
   - Configuration in `~/.gemini/settings.json`
   - Dynamic tool registration
   - OAuth support for MCP servers

## Testing Conventions

This project uses **Vitest** with specific patterns:

### Test Organization

- Tests are co-located with source files (`*.test.ts`, `*.test.tsx`)
- Mock ES modules at the top of test files before imports
- Use `vi.hoisted()` for mock functions needed in module factories
- Always reset mocks in `beforeEach` and restore in `afterEach`

### React Component Testing

- Use `ink-testing-library` for CLI UI components
- Test with `render()` and assert with `lastFrame()`
- Mock complex child components and hooks

### Common Mocking Patterns

```typescript
// Mock at top of file before imports
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, homedir: vi.fn() };
});

// In tests
beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

## Code Style Guidelines

### JavaScript/TypeScript Patterns

- **Prefer plain objects over classes** with TypeScript interfaces
- **Use ES module exports** for API boundaries (not class members)
- **Avoid `any` types** - use `unknown` when type is truly unknown
- **Embrace functional patterns** - use array methods like `.map()`,
  `.filter()`, `.reduce()`
- **Immutable state updates** - never mutate state directly

### React Best Practices

- **Use functional components with hooks** - no class components
- **Keep components pure** - side effects only in `useEffect` or event handlers
- **Avoid excessive `useEffect`** - prefer event handlers for user actions
- **Let React Compiler optimize** - avoid premature memoization
- **Small, composable components** - break down complex UIs

### Naming Conventions

- **Use hyphens in flag names**: `--my-flag` not `--my_flag`
- **TypeScript interfaces**: Start with `I` or use descriptive names
- **File names**: Use camelCase for `.ts` files, PascalCase for `.tsx`
  components

## Important Files and Directories

### Configuration Files

- `.gemini/config.yaml` - Project-specific Gemini CLI configuration
- `~/.gemini/settings.json` - User settings including MCP servers
- `GEMINI.md` - Project context for Gemini CLI (similar to this file)
- `.gemini-ignore` - Files to exclude from context

### Core Components

- `packages/cli/src/gemini.tsx` - Main CLI entry point
- `packages/core/src/core/client.ts` - Gemini API client
- `packages/core/src/tools/tool-registry.ts` - Tool registration system
- `packages/cli/src/services/CommandService.ts` - Command management

## Development Workflow

1. **Before making changes**: Run `npm install` to ensure dependencies are up to
   date
2. **During development**: Use `npm run start` to test changes interactively
3. **Before committing**:
   - Run `npm run preflight` to ensure all checks pass
   - Fix any linting issues with `npm run lint:fix`
   - Format code with `npm run format`
4. **For debugging**: Use `npm run debug` to attach Node inspector

## Environment Variables

Key environment variables for development:

- `GEMINI_API_KEY` - Gemini API key authentication
- `GOOGLE_API_KEY` - Vertex AI authentication
- `GOOGLE_CLOUD_PROJECT` - GCP project for Code Assist
- `GOOGLE_GENAI_USE_VERTEXAI` - Enable Vertex AI mode
- `DEBUG=1` - Enable debug logging
- `GEMINI_SANDBOX` - Sandbox mode (false/docker/podman)

## Notes on Security and Sandboxing

- The CLI supports sandboxed execution using Docker/Podman
- Sandbox profiles are defined in `*.sb` files for macOS
- Tools declare their capabilities (e.g., `modifiesFileSystem`)
- User confirmation required for filesystem modifications and shell commands
- Read-only operations may proceed without confirmation

## Git Workflow

- Main branch: `main`
- Use conventional commits when possible
- Run `npm run preflight` before creating PRs
- Integration tests run in CI for all PRs
