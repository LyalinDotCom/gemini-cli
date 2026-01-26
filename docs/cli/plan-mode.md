# Plan Mode

Plan Mode is a dedicated read-only workflow that enforces "Research → Clarify →
Plan" before any code changes. It is designed for careful planning and a clean
transition to execution.

## Overview

Plan Mode helps you:

- **Research safely** - The agent can read files, search code, and gather
  context without modifying anything.
- **Clarify requirements** - The agent asks 1-5 targeted questions before
  finalizing a plan.
- **Create structured plans** - Plans are saved as draft, then can be executed
  or refined.
- **Run tools in parallel** - Read-only tools execute concurrently for faster
  exploration.

## Entering Plan Mode

### Keyboard Toggle

Press **Shift+Tab** to cycle through approval modes:

1. **Default** - Standard mode with confirmation prompts
2. **Auto Edit** - Automatically approve edits
3. **Plan Mode** - Read-only planning

When Plan Mode is active, you'll see a **"plan mode"** indicator in the status
bar.

### Command Line

Start in Plan Mode:

```bash
gemini --approval-mode plan
```

## How Plan Mode Works

### Allowed Tools (Auto-Approved)

Read-only tools run without confirmation:

| Tool                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `read_file`           | Read individual files                |
| `read_many_files`     | Read multiple files at once          |
| `search_file_content` | Search code with grep/ripgrep        |
| `glob`                | Find files by pattern                |
| `list_directory`      | List directory contents              |
| `web_fetch`           | Fetch web content                    |
| `google_web_search`   | Search the web                       |
| `write_todos`         | Track planning progress              |
| `ask_questions`       | Ask pre-plan clarification questions |
| `present_plan`        | Present a completed plan             |

> **Note:** MCP tools are blocked in Plan Mode for safety.

### Planning Workflow

1. **Research Phase**
   - Use read-only tools to explore the codebase.
2. **Clarification Phase**
   - If requirements are unclear, the agent asks **1-5 questions**.
   - All questions require answers (no skips).
3. **Plan Phase**
   - The agent produces a detailed implementation plan.
4. **Completion Dialog**
   - Execute (default)
   - Execute with clean context
   - Save
   - Refine
   - Cancel

## Managing Plans

Plan Mode saves drafts automatically and provides `/plan` commands.

### List Plans

```
/plan list
```

### View a Plan

```
/plan view <title>
```

### Resume / Execute

```
/plan resume <title>
```

### Delete a Plan

```
/plan delete <title>
```

### Export a Plan

```
/plan export <title> <filename>
```

Plans are stored in `.gemini/plans/` as Markdown with YAML frontmatter.

## Troubleshooting

### Agent Tries to Modify Files

Plan Mode denies all mutating tools. If you need to implement, switch to Auto
Edit or Default mode.

### Plan Not Appearing

Plans are auto-saved as drafts when `present_plan` is called. If no plan appears
in `/plan list`, the planning step may not have completed.

## Related Docs

- [Commands](./commands.md)
- [Keyboard Shortcuts](./keyboard-shortcuts.md)
- [Configuration](./settings.md)
