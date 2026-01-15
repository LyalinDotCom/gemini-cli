# Get started with Gemini CLI

Go from zero to AI-powered development in under a minute.

## Quick install

```bash
npm install -g @google/gemini-cli
gemini
```

That's it. Select "Login with Google" when prompted, and you're ready to go.

## Your first conversation

Once authenticated, try these prompts to see what Gemini CLI can do:

### Explore a codebase

```
> What does this project do? Give me a high-level overview.
```

Gemini CLI analyzes your files, dependencies, and structure to provide an
accurate summary.

### Make changes

```
> Add error handling to the fetchUser function in src/api/users.ts
```

Watch as it reads the file, understands the context, proposes changes, and asks
for your approval before writing.

### Run commands

```
> Run the tests and fix any failures
```

Gemini CLI executes `npm test` (or your test command), analyzes failures, and
implements fixes.

### Search the web

```
> What's the recommended way to handle authentication in Next.js 15?
```

Get up-to-date answers grounded in current documentation and best practices.

## What you get for free

With your Google account, you get:

| Limit | Amount |
|-------|--------|
| Requests per minute | 60 |
| Requests per day | 1,000 |
| Context window | 1M tokens |
| Credit card required | No |

This is enough for most individual developers. Need more?
[See pricing options](../quota-and-pricing.md).

## Supercharge with extensions

Gemini CLI becomes even more powerful with extensions. Browse **288+
extensions** in the [Extensions Gallery](https://geminicli.com/extensions) or
install popular ones directly:

```bash
# GitHub integration for PRs, issues, and code review
gemini extensions install https://github.com/anthropics/github-mcp-server

# PostgreSQL database access
gemini extensions install https://github.com/anthropics/postgres-mcp-server

# Filesystem operations across directories
gemini extensions install https://github.com/anthropics/filesystem-mcp-server
```

Extensions add new capabilities like database access, API integrations, and
specialized workflows. [Learn more about extensions →](../extensions/index.md)

## Installation options

### npm (recommended)

```bash
npm install -g @google/gemini-cli
```

### npx (no install)

```bash
npx @google/gemini-cli
```

### Homebrew (macOS)

```bash
brew install gemini-cli
```

### From source

```bash
git clone https://github.com/google-gemini/gemini-cli.git
cd gemini-cli
npm install
npm run build
npm link
```

[Complete installation guide →](./installation.md)

## Authentication methods

### Google account (easiest)

When you run `gemini` for the first time, select "Login with Google". This gives
you access to the free tier immediately.

### API key

For programmatic access or custom quotas:

```bash
export GEMINI_API_KEY="your-api-key"
gemini
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

### Vertex AI (enterprise)

For organizations using Google Cloud:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
gemini
```

[Complete authentication guide →](./authentication.md)

## Configure your experience

### Set your preferred editor

```bash
# In ~/.gemini/settings.json
{
  "general": {
    "preferredEditor": "code"
  }
}
```

### Enable Vim mode

```bash
{
  "general": {
    "vimMode": true
  }
}
```

### Choose a theme

```bash
{
  "ui": {
    "theme": "GitHub"
  }
}
```

[Complete configuration guide →](./configuration.md)

## Next steps

Now that you're set up, explore what's possible:

| I want to... | Go here |
|--------------|---------|
| See example workflows | [Examples](./examples.md) |
| Learn the commands | [Commands reference](../cli/commands.md) |
| Install extensions | [Extensions gallery](https://geminicli.com/extensions) |
| Build my own extension | [Extension development](../extensions/index.md) |
| Use in CI/CD pipelines | [Headless mode](../cli/headless.md) |
| Deploy to my team | [Enterprise setup](../cli/enterprise.md) |
| Try the latest model | [Gemini 3](./gemini-3.md) |

## Get help

Stuck? Here's where to find answers:

- **[FAQ](../faq.md)** - Common questions and answers
- **[Troubleshooting](../troubleshooting.md)** - Solutions to common problems
- **[GitHub Issues](https://github.com/google-gemini/gemini-cli/issues)** -
  Report bugs or request features
