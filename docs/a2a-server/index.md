# A2A Server

The A2A (Agent-to-Agent) Server is an HTTP-based agent server that implements the
A2A protocol to enable the **Gemini SDLC Agent** - an AI-powered code generation
and development assistant. This package provides a production-ready interface for
integrating Gemini CLI capabilities with IDEs, web platforms, and other client
applications.

## Overview

The A2A server:

- **Runs as an HTTP service** that integrates with Gemini CLI's core capabilities
- **Implements the A2A protocol** - an open standard adopted by the Linux
  Foundation for agent communication
- **Provides streaming, task-based interface** for code generation, file
  manipulation, shell execution, and other development workflows
- **Manages task lifecycle** including creation, execution, tool confirmation,
  and state persistence

## When to use the A2A server

The A2A server is ideal for:

- **IDE integrations** - Building editor extensions that need Gemini capabilities
- **Web applications** - Creating web-based development assistants
- **Enterprise deployments** - Running agents as persistent services
- **Multi-client scenarios** - Supporting multiple clients connecting to the same
  agent

## Quick start

### Starting the server

```bash
# Build and start the server
cd packages/a2a-server
npm run build
npm start

# With custom port
CODER_AGENT_PORT=3000 npm start

# With GCS persistence (for production)
GCS_BUCKET_NAME=my-bucket npm start
```

### Creating a task

```bash
curl -X POST http://localhost:41242/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "contextId": "context-123",
    "agentSettings": {
      "kind": "agent-settings",
      "workspacePath": "/path/to/project",
      "autoExecute": false
    }
  }'
```

### Submitting a message

```bash
curl -X POST http://localhost:41242/message/stream \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-id-from-above",
    "contextId": "context-123",
    "userMessage": {
      "kind": "message",
      "role": "user",
      "parts": [{"kind": "text", "text": "Create a React component for user login"}],
      "messageId": "msg-1"
    }
  }'
```

## Architecture

The A2A server consists of several components:

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Server                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   /tasks        │  │ /message/stream │  │ /commands    │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
└───────────┼─────────────────────┼─────────────────┼─────────┘
            │                     │                 │
            ▼                     ▼                 ▼
┌───────────────────────────────────────────────────────────────┐
│                     CoderAgentExecutor                        │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────┐  │
│  │ Task Manager │  │ Tool Scheduler│  │ Command Registry  │  │
│  └──────────────┘  └───────────────┘  └───────────────────┘  │
└───────────────────────────────────────────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────┐  ┌────────────────────┐
│  Gemini CLI Core  │  │  Persistence Layer │
│  (Tools, Config)  │  │  (GCS / In-Memory) │
└───────────────────┘  └────────────────────┘
```

## Key features

### Streaming responses

All responses are delivered as Server-Sent Events (SSE), enabling real-time
progress updates:

- Tool execution status
- Agent thinking/reasoning
- Text content generation
- State changes

### Task-based execution

Work is organized around long-lived tasks with persistent state:

- Tasks can be paused and resumed
- State is preserved across server restarts (with GCS)
- Multiple tasks can run concurrently

### Tool confirmation workflow

Sensitive operations require user approval:

1. Agent requests a tool (e.g., file write)
2. Server publishes `ToolCallConfirmationEvent`
3. Client displays confirmation UI
4. User approves/rejects
5. Server resumes execution

### Built-in commands

The server includes commands accessible via `/executeCommand`:

- **`init`** - Analyze workspace and generate GEMINI.md
- **`memory show|add|refresh|list`** - Manage agent context
- **`extensions list`** - List installed MCP extensions
- **`restore list|<name>`** - Restore from checkpoints

## Navigating this section

- **[Protocol](./protocol.md)** - Event types and message formats
- **[Commands](./commands.md)** - Available server commands

## Environment variables

| Variable | Description |
|----------|-------------|
| `CODER_AGENT_PORT` | Server listening port (random if not set) |
| `CODER_AGENT_WORKSPACE_PATH` | Default workspace root |
| `GCS_BUCKET_NAME` | Enable GCS task persistence |
| `GEMINI_FOLDER_TRUST` | Trust all folders |
| `GEMINI_YOLO_MODE` | Auto-execute tools without confirmation |
| `CHECKPOINTING` | Enable Git checkpointing |

## Related documentation

- [Gemini CLI Core](../core/index.md) - Backend capabilities
- [Tools](../tools/index.md) - Available tools
- [IDE Integration](../ide-integration/index.md) - IDE companion spec
