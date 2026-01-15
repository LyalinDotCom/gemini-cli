# Agents

Gemini CLI includes an agent system that enables specialized AI assistants to
handle complex tasks. Agents can run locally within the CLI or connect to remote
A2A (Agent-to-Agent) services.

## Overview

The agent system provides:

- **Local agents** - Run directly in the CLI process with their own tool set
- **Remote agents** - Proxy to external A2A services via HTTP
- **Agent delegation** - Main agent can delegate tasks to specialized sub-agents
- **Tool isolation** - Each agent has its own sandboxed tool registry
- **Structured outputs** - Agents support schema validation for outputs

## Built-in agents

### Codebase Investigator

A specialized agent for deep analysis of codebase structure, dependencies, and
architecture.

**Name:** `codebase_investigator`

**Purpose:** Systematic exploration and understanding of codebases, finding where
functionality is implemented, and analyzing code patterns.

**Available tools:**

- `ls` - List directories
- `read_file` - Read file contents
- `glob` - Find files by pattern
- `search_file_content` - Search within files

**Configuration:**

- Temperature: 0.1 (deterministic)
- Extended thinking: Enabled
- Max time: 5 minutes
- Max turns: 15

**Example usage:**

```
> /agents invoke codebase_investigator "Where is authentication handled and how does the session management work?"
```

**Output schema:**

```typescript
{
  SummaryOfFindings: string;      // Root cause analysis and insights
  ExplorationTrace: string[];     // Step-by-step action trace
  RelevantLocations: Array<{
    FilePath: string;
    Reasoning: string;
    KeySymbols: string[];
  }>;
}
```

### CLI Help Agent

An agent that answers questions about Gemini CLI itself, its features,
configuration, and usage.

**Name:** `cli_help`

**Purpose:** Self-documentation - answering user questions about how to use
Gemini CLI.

**Available tools:**

- `get_internal_docs` - Access CLI documentation

**Configuration:**

- Model: Flash (faster, cheaper)
- Temperature: 0.1 (factual)
- Max time: 3 minutes
- Max turns: 10

**Example usage:**

```
> /agents invoke cli_help "How do I configure MCP servers?"
```

**Output schema:**

```typescript
{
  answer: string;      // Detailed answer
  sources: string[];   // Documentation files used
}
```

## Enabling agents

Agents are controlled via settings:

```json
{
  "agents": {
    "enabled": true
  },
  "codebaseInvestigator": {
    "enabled": true,
    "model": "gemini-2.5-pro",
    "thinkingBudget": -1,
    "maxTimeMinutes": 5
  },
  "cliHelpAgent": {
    "enabled": true
  }
}
```

## Agent commands

### List available agents

```
/agents list
```

Shows all registered agents (built-in and custom).

### Refresh agents

```
/agents refresh
```

Reloads agent definitions from directories.

### Invoke an agent

```
/agents invoke <agent-name> "<task description>"
```

Directly invokes a specific agent with a task.

## Creating custom agents

You can create custom agents by adding Markdown files to:

- **User level:** `~/.gemini/agents/` (always loaded)
- **Project level:** `.gemini/agents/` (requires folder trust)

### Agent definition format

Create a `.md` file with YAML frontmatter:

```markdown
---
name: my-custom-agent
display_name: My Custom Agent
kind: local
description: Summarizes documentation files
tools:
  - read_file
  - search_file_content
  - glob
model: gemini-2.5-flash
temperature: 0.1
max_turns: 20
timeout_mins: 5
---

You are a documentation expert. Your task is to create comprehensive summaries.

Use the available tools to thoroughly explore the documentation structure.
When you have gathered all information, call `complete_task` with your summary.
```

### Frontmatter fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique slug (lowercase, numbers, `-`, `_`) |
| `display_name` | string | No | Human-readable name |
| `kind` | string | No | `local` (default) or `remote` |
| `description` | string | Yes | What the agent does |
| `tools` | string[] | No | Available tools (defaults to all) |
| `model` | string | No | Model to use or `inherit` |
| `temperature` | number | No | 0-2, defaults to 1 |
| `max_turns` | number | No | Maximum conversation turns |
| `timeout_mins` | number | No | Maximum execution time |

### Tool restrictions

Agents can only use a subset of tools. Available tools:

- `read_file`, `glob`, `ls`, `search_file_content` - File reading
- `write_file`, `edit` - File writing (use with caution)
- `run_shell_command` - Shell execution
- `web_fetch`, `google_web_search` - Web access
- `save_memory` - Memory persistence

**Important:** Agents cannot include `delegate_to_agent` in their tools list
(sub-agents cannot delegate further).

### Remote agents

For remote A2A agents, use `kind: remote`:

```markdown
---
name: my-remote-agent
kind: remote
display_name: Remote Code Assistant
description: Code generation via remote A2A service
agent_card_url: https://api.example.com/.well-known/agent-card.json
---
```

## Agent delegation

The main agent can delegate tasks to sub-agents using the `delegate_to_agent`
tool. This is automatic when agents are enabled.

### How delegation works

1. Main agent identifies a specialized task
2. Calls `delegate_to_agent` with agent name and parameters
3. Sub-agent executes with isolated tool registry
4. Results returned to main agent

### Example delegation

The main agent might delegate like this:

```
I need to understand how authentication works in this codebase.
Let me delegate to the codebase_investigator agent.

[Calling delegate_to_agent with:
  agent_name: "codebase_investigator"
  objective: "Find and analyze all authentication-related code..."
]
```

## Agent execution

### Local agent loop

Local agents run in an execution loop:

1. **Initialize** - Create isolated tool registry
2. **Template** - Apply inputs to system prompt
3. **Execute** - Run agent loop until completion
4. **Complete** - Agent calls `complete_task` with output

### Termination modes

| Mode | Description |
|------|-------------|
| `GOAL` | Successfully completed |
| `TIMEOUT` | Exceeded max time |
| `MAX_TURNS` | Exceeded max turns |
| `ERROR` | Unexpected error |
| `ABORTED` | User canceled |

### Grace period

If an agent times out or reaches max turns, it gets a 60-second grace period to
call `complete_task` and provide partial results.

## Settings overrides

Override agent configuration via settings:

```json
{
  "agents": {
    "overrides": {
      "codebase_investigator": {
        "disabled": false,
        "runConfig": {
          "maxTimeMinutes": 10,
          "maxTurns": 25
        },
        "modelConfig": {
          "model": "gemini-2.5-pro",
          "generateContentConfig": {
            "temperature": 0.2
          }
        }
      }
    }
  }
}
```

## Security considerations

- Agents run with YOLO approval mode (no confirmation prompts)
- Tool access should be restricted to what's necessary
- Project-level agents require folder trust
- Remote agents require explicit approval before first use

## Related documentation

- [A2A Server](../a2a-server/index.md) - HTTP-based agent server
- [Tools](../tools/index.md) - Available tools for agents
- [Skills](../cli/skills.md) - Skill system (different from agents)
