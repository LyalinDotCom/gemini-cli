# Gemini CLI

**The AI coding agent that lives in your terminal.**

Gemini CLI is Google's open-source AI agent that brings the full power of Gemini
directly to your command line. Ship features faster, debug smarter, and automate
the tedious parts of development - all without leaving your terminal.

```bash
npm install -g @google/gemini-cli && gemini
```

## Why developers choose Gemini CLI

### Understand entire codebases instantly

With a **1 million token context window**, Gemini CLI can analyze your entire
codebase in a single conversation. No more jumping between files or losing
context.

```
> Where is authentication handled in this codebase?

I found the authentication system across several files:

- src/auth/provider.ts:42 - Main OAuth provider implementation
- src/middleware/session.ts:15 - Session validation middleware
- src/routes/login.ts:8 - Login endpoint handler

The flow starts when...
```

### Execute real tasks, not just chat

Gemini CLI isn't just a chatbot - it's an agent that takes action. It reads
files, writes code, runs commands, and searches the web to complete your tasks.

```
> Add input validation to the user registration form and write tests for it

Creating validation schema in src/validation/user.ts...
Updating UserRegistrationForm component...
Writing test cases in tests/user-registration.test.ts...
Running npm test to verify...

✓ All 12 tests passed. Changes ready for review.
```

### Generous free tier

Get started immediately with your Google account:

- **60 requests per minute**
- **1,000 requests per day**
- **No credit card required**

Need more? [Explore paid options](./quota-and-pricing.md) for higher limits.

### Extend without limits

Build on top of Gemini CLI with a powerful extension system:

- **[MCP Servers](./tools/mcp-server.md)** - Connect to databases, APIs, and
  external services
- **[Extensions](./extensions/index.md)** - Package and share custom
  capabilities
- **[Hooks](./hooks/index.md)** - Intercept and customize behavior at any point
- **[Skills](./cli/skills.md)** - Create reusable workflows for common tasks
- **[Custom Agents](./core/agents.md)** - Build specialized AI assistants

## Get started in 60 seconds

### 1. Install

```bash
npm install -g @google/gemini-cli
```

### 2. Launch and authenticate

```bash
gemini
```

Select "Login with Google" and sign in with your Google account.

### 3. Start building

```
> Explain what this codebase does and suggest improvements
```

**[Complete installation guide →](./get-started/installation.md)**

## What can you build?

### Automate your workflow

```bash
# Generate commit messages from staged changes
git diff --staged | gemini -p "Write a commit message for these changes"

# Explain error logs
cat error.log | gemini -p "What went wrong and how do I fix it?"

# Generate documentation
gemini -p "Document all public functions in src/api/"
```

### Integrate with your IDE

The [A2A Server](./a2a-server/index.md) enables deep IDE integration, powering
AI-assisted development in VS Code and other editors.

### Deploy to your team

[Enterprise configuration](./cli/enterprise.md) supports centralized settings,
policy enforcement, and compliance controls for teams of any size.

## Documentation

### Getting started

| Guide | Description |
|-------|-------------|
| [Quickstart](./get-started/index.md) | Install and run your first command |
| [Authentication](./get-started/authentication.md) | Configure Google or API key auth |
| [Configuration](./get-started/configuration.md) | Customize CLI behavior |
| [Examples](./get-started/examples.md) | Common use cases and patterns |

### Core concepts

| Topic | Description |
|-------|-------------|
| [Commands](./cli/commands.md) | Built-in slash commands reference |
| [Tools](./tools/index.md) | File, shell, web, and memory tools |
| [Agents](./core/agents.md) | Built-in and custom agent system |
| [Safety](./core/safety.md) | Security features and tool confirmation |

### Extending Gemini CLI

| Topic | Description |
|-------|-------------|
| [MCP Servers](./tools/mcp-server.md) | Connect external services |
| [Extensions](./extensions/index.md) | Package custom functionality |
| [Hooks](./hooks/index.md) | Lifecycle event handlers |
| [Skills](./cli/skills.md) | Reusable task workflows |

### Advanced topics

| Topic | Description |
|-------|-------------|
| [Headless mode](./cli/headless.md) | Scripting and automation |
| [Sandboxing](./cli/sandbox.md) | Isolated execution environments |
| [A2A Server](./a2a-server/index.md) | IDE and web integration |
| [Policy Engine](./core/policy-engine.md) | Fine-grained tool control |

### Reference

| Topic | Description |
|-------|-------------|
| [Architecture](./architecture.md) | System design overview |
| [FAQ](./faq.md) | Common questions |
| [Troubleshooting](./troubleshooting.md) | Problem resolution |
| [Changelog](./changelogs/index.md) | Release history |

## Join the community

Gemini CLI is open source and community-driven.

- **[GitHub](https://github.com/google-gemini/gemini-cli)** - Star the repo,
  report issues, contribute code
- **[Extensions Gallery](https://geminicli.com/extensions/browse/)** - Discover
  and share extensions

---

Ready to supercharge your development workflow?

```bash
npm install -g @google/gemini-cli && gemini
```
