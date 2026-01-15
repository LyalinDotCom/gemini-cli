# Gemini CLI

Gemini CLI is Google's open-source, terminal-first AI agent that brings the
power of Gemini directly to your command line. With a 1M token context window
and a generous free tier (60 requests/min, 1,000 requests/day), Gemini CLI
enables you to interact with one of the most capable AI models available.

Within Gemini CLI, `packages/cli` is the frontend for users to send and receive
prompts with the Gemini AI model and its associated tools. For a general
overview of Gemini CLI, see the [main documentation page](../index.md).

## Core features

- **[Commands](./commands.md):** A reference for all built-in slash commands
- **[Custom commands](./custom-commands.md):** Create your own commands and
  shortcuts for frequently used prompts.
- **[Agent Skills](./skills.md):** Extend Gemini CLI with specialized expertise
  and procedural workflows.
- **[Session management](./session-management.md):** Save, resume, and manage
  conversation sessions.
- **[Headless mode](./headless.md):** Use Gemini CLI programmatically for
  scripting and automation.

## Configuration

- **[Model selection](./model.md):** Configure the Gemini AI model used by the
  CLI.
- **[Model routing](./model-routing.md):** Automatic model selection based on
  task complexity.
- **[Settings](./settings.md):** Configure various aspects of the CLI's behavior
  and appearance.
- **[Generation settings](./generation-settings.md):** Fine-tune model
  generation parameters.
- **[Themes](./themes.md):** Customizing the CLI's appearance with different
  themes.
- **[Keyboard shortcuts](./keyboard-shortcuts.md):** A reference for all
  keyboard shortcuts to improve your workflow.

## Advanced features

- **[Checkpointing](./checkpointing.md):** Automatically save and restore
  snapshots of your session and files.
- **[Rewind](./rewind.md):** Undo changes and restore previous states.
- **[Enterprise configuration](./enterprise.md):** Deploying and manage Gemini
  CLI in an enterprise environment.
- **[Sandboxing](./sandbox.md):** Isolate tool execution in a secure,
  containerized environment.
- **[Telemetry](./telemetry.md):** Configure observability to monitor usage and
  performance.
- **[Token caching](./token-caching.md):** Optimize API costs by caching tokens.
- **[Trusted folders](./trusted-folders.md):** A security feature to control
  which projects can use the full capabilities of the CLI.

## Context and memory

- **[Ignoring files (.geminiignore)](./gemini-ignore.md):** Exclude specific
  files and directories from being accessed by tools.
- **[Context files (GEMINI.md)](./gemini-md.md):** Provide persistent,
  hierarchical context to the model.
- **[System prompt override](./system-prompt.md):** Replace the built-in system
  instructions using `GEMINI_SYSTEM_MD`.

## Tutorials

- **[Tutorials](./tutorials.md):** Step-by-step guides for common tasks.
- **[Skills getting started](./tutorials/skills-getting-started.md):** Create
  your first skill.

## Non-interactive mode

Gemini CLI can be run in a non-interactive mode, which is useful for scripting
and automation. In this mode, you pipe input to the CLI, it executes the
command, and then it exits.

The following example pipes a command to Gemini CLI from your terminal:

```bash
echo "What is fine tuning?" | gemini
```

You can also use the `--prompt` or `-p` flag:

```bash
gemini -p "What is fine tuning?"
```

For comprehensive documentation on headless usage, scripting, automation, and
advanced examples, see the **[Headless mode](./headless.md)** guide.

## Authentication

- **[Authentication](./authentication.md):** Configure authentication methods.
- **[Uninstall](./uninstall.md):** Methods for uninstalling Gemini CLI.
