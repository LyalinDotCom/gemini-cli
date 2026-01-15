# Gemini CLI features

Gemini CLI is more than a chat interface - it's a complete development
environment powered by AI. This guide covers the features that make it the most
capable terminal-based AI agent available.

## Interactive conversations

Launch with `gemini` and start a conversation:

```
> Refactor the authentication module to use async/await instead of callbacks

I'll analyze the authentication module and refactor it to use modern async/await
syntax. Let me start by reading the relevant files...

Reading src/auth/login.ts...
Reading src/auth/session.ts...
Reading src/auth/middleware.ts...

I found 3 files that need updating. Here's my plan:
1. Convert callback-based functions to async/await
2. Update error handling to use try/catch
3. Ensure backward compatibility with existing callers

Starting with src/auth/login.ts...
```

The agent reads files, understands context, plans its approach, and executes -
all while keeping you informed.

## Powerful commands

Control Gemini CLI with slash commands:

| Command | What it does |
|---------|--------------|
| `/help` | Show all available commands |
| `/model` | Switch between Gemini models |
| `/memory` | View and manage context files |
| `/clear` | Start a fresh conversation |
| `/compact` | Summarize history to save tokens |
| `/settings` | Open the settings editor |
| `/skills` | Manage agent skills |
| `/agents` | Control sub-agents |

[Complete commands reference →](./commands.md)

## Agent skills

Skills give Gemini CLI specialized expertise for specific tasks. Invoke them
with slash commands:

```
> /commit

Analyzing staged changes...

Commit message:
feat(auth): add OAuth2 support for GitHub login

- Add GitHubOAuthProvider class
- Implement token refresh logic
- Add integration tests

Ready to commit? [y/n]
```

Built-in skills include:

- **`/commit`** - Generate semantic commit messages
- **`/pr`** - Create pull requests with descriptions
- **`/review`** - Review code changes

[Create your own skills →](./skills.md)

## Custom commands

Create shortcuts for prompts you use frequently:

```toml
# ~/.gemini/commands/explain.toml
[command]
description = "Explain code in detail"

[prompt]
content = """
Explain this code in detail:
- What it does
- How it works
- Any potential issues
"""
```

Then use it:

```
> /explain @src/utils/cache.ts
```

[Custom commands guide →](./custom-commands.md)

## Session management

Your conversations persist automatically:

```bash
# Resume your last session
gemini --resume

# Resume a specific session
gemini --resume 5

# List all sessions
gemini --list-sessions
```

[Session management guide →](./session-management.md)

## Context and memory

### GEMINI.md files

Create `GEMINI.md` files to give the AI persistent context about your project:

```markdown
# Project Context

This is a TypeScript monorepo using pnpm workspaces.

## Conventions
- Use functional components with hooks
- Tests go in __tests__ directories
- Follow the existing ESLint configuration

## Architecture
- /packages/core - Shared business logic
- /packages/web - Next.js frontend
- /packages/api - Express backend
```

Gemini CLI automatically discovers these files throughout your project
hierarchy. [Learn more →](./gemini-md.md)

### .geminiignore

Keep sensitive or irrelevant files out of the AI's view:

```gitignore
# Secrets
.env*
*.pem
credentials.json

# Build output
dist/
node_modules/
```

[Ignoring files guide →](./gemini-ignore.md)

## Headless mode for automation

Integrate Gemini CLI into scripts and CI/CD pipelines:

```bash
# Generate a commit message
git diff --staged | gemini -p "Write a commit message" --output-format json

# Explain an error log
cat error.log | gemini -p "What went wrong?" -o text

# Batch process files
gemini -p "Add TypeScript types to all functions in src/utils/"
```

[Headless mode guide →](./headless.md)

## Security features

### Tool confirmation

Sensitive operations require your approval:

```
Gemini wants to run: rm -rf node_modules && npm install

[a]llow  [d]eny  [e]dit  allow [A]lways
```

### Sandboxing

Run commands in isolated environments:

```bash
# Docker sandbox
gemini --sandbox

# macOS sandbox-exec
gemini -s
```

[Sandboxing guide →](./sandbox.md)

### Trusted folders

Control which directories Gemini CLI can access:

```bash
gemini /trust /path/to/project
```

[Trusted folders guide →](./trusted-folders.md)

## Checkpointing

Automatically save snapshots of your work:

```json
{
  "general": {
    "checkpointing": {
      "enabled": true
    }
  }
}
```

Then rewind when needed:

```
> /rewind

Available checkpoints:
1. 2 minutes ago - Before refactoring auth module
2. 15 minutes ago - Before adding tests
3. 1 hour ago - Initial state

Select checkpoint: 1

Restoring files...
✓ Restored 3 files to checkpoint state
```

[Checkpointing guide →](./checkpointing.md)

## Customization

### Themes

Choose from built-in themes or create your own:

```json
{
  "ui": {
    "theme": "GitHub"
  }
}
```

Available themes: Default, GitHub, Monokai, Dracula, Nord, and more.

[Themes guide →](./themes.md)

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current operation |
| `Ctrl+L` | Clear screen |
| `Ctrl+R` | Search history |
| `Tab` | Autocomplete |
| `↑/↓` | Navigate history |

[Full shortcuts reference →](./keyboard-shortcuts.md)

## Enterprise features

Deploy Gemini CLI across your organization:

- **Centralized configuration** - System-wide settings files
- **Policy enforcement** - Control which tools can be used
- **Audit logging** - Track all operations
- **SSO integration** - Connect to your identity provider

[Enterprise guide →](./enterprise.md)

## What's next?

| Goal | Resource |
|------|----------|
| Choose the right model | [Models guide](./models.md) |
| Master the commands | [Commands reference](./commands.md) |
| Create custom skills | [Skills tutorial](./tutorials/skills-getting-started.md) |
| Automate workflows | [Headless mode](./headless.md) |
| Secure your setup | [Security guide](../core/safety.md) |
| Deploy to team | [Enterprise setup](./enterprise.md) |
