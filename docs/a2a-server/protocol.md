# A2A Protocol

The A2A server implements a streaming protocol based on Server-Sent Events (SSE)
for real-time communication between clients and the Gemini SDLC Agent.

## Event types

The server publishes events through the `CoderAgentEvent` enum:

| Event | Description |
|-------|-------------|
| `tool-call-confirmation` | Request user approval for a tool |
| `tool-call-update` | Tool execution status change |
| `text-content` | Agent text responses |
| `state-change` | Task state transitions |
| `agent-settings` | Configuration settings |
| `thought` | Agent reasoning (when extended thinking enabled) |
| `citation` | Source citations |

## Task states

Tasks progress through these states:

```
submitted → working → input-required → completed
                ↓           ↓
              failed     canceled
```

| State | Description |
|-------|-------------|
| `submitted` | Task created, not yet started |
| `working` | Agent actively processing |
| `input-required` | Awaiting user confirmation for tool |
| `completed` | Successfully finished |
| `failed` | Error occurred |
| `canceled` | User canceled |

## Message types

### Agent settings

Configuration sent with task creation:

```typescript
{
  kind: 'agent-settings',
  workspacePath: string,      // Workspace root directory
  autoExecute?: boolean       // Auto-execute tools without confirmation
}
```

### Task metadata

Information about a running task:

```typescript
{
  id: string,
  contextId: string,
  taskState: TaskState,
  model: string,
  mcpServers: Array<{
    name: string,
    status: MCPServerStatus,
    tools: Array<{ name, description, parameterSchema }>
  }>,
  availableTools: Array<{ name, description, parameterSchema }>
}
```

### Tool call confirmation

Request for user approval:

```typescript
{
  kind: 'tool-call-confirmation',
  toolCallId: string,
  toolName: string,
  inputParameters: object,
  confirmationRequest: {
    title: string,
    prompt: string,
    type: 'info' | 'warning' | 'danger'
  }
}
```

### Tool call update

Status change for a tool execution:

```typescript
{
  kind: 'tool-call-update',
  toolCallId: string,
  toolName: string,
  status: 'PENDING' | 'EXECUTING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
  inputParameters?: object,
  result?: string,
  error?: string
}
```

## API endpoints

### Core A2A endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/agent-card.json` | GET | Agent metadata and capabilities |
| `/tasks` | POST | Create a new task |
| `/message/stream` | POST | Submit message and receive SSE stream |

### Custom endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tasks/:taskId/metadata` | GET | Get task metadata |
| `/tasks/metadata` | GET | List all tasks (in-memory only) |
| `/executeCommand` | POST | Execute a registered command |
| `/listCommands` | GET | List available commands |

## Agent card

The server advertises its capabilities via the agent card:

```json
{
  "name": "Gemini SDLC Agent",
  "description": "Generates code based on instructions",
  "url": "http://localhost:41242/",
  "capabilities": {
    "streaming": true,
    "stateTransitionHistory": true
  },
  "skills": [{
    "id": "code_generation",
    "name": "Code Generation",
    "tags": ["code", "development", "programming"]
  }]
}
```

## Event flow example

A typical code generation flow:

```
Client                           A2A Server
  │                                  │
  ├─ POST /tasks ────────────────────>│ Task created
  │                                  │
  ├─ POST /message/stream ───────────>│ User message
  │  (user prompt + settings)        │
  │                                  │
  │<────────────────────────────────── state-change: working
  │                                  │
  │<────────────────────────────────── thought: "I'll create..."
  │                                  │
  │<────────────────────────────────── tool-call-update: PENDING
  │                                  │  (write_file requested)
  │                                  │
  │<────────────────────────────────── tool-call-confirmation
  │<────────────────────────────────── state-change: input-required
  │                                  │
  ├─ POST /message/stream ───────────>│ ToolCallConfirmation: approved
  │                                  │
  │<────────────────────────────────── state-change: working
  │<────────────────────────────────── tool-call-update: EXECUTING
  │<────────────────────────────────── tool-call-update: SUCCEEDED
  │                                  │
  │<────────────────────────────────── text-content: "I've created..."
  │<────────────────────────────────── state-change: completed
```

## Tool call lifecycle

Each tool call progresses through states:

```
PENDING → EXECUTING → SUCCEEDED
              ↓           ↓
           FAILED     CANCELLED
```

- **PENDING** - Tool requested, awaiting confirmation (if required)
- **EXECUTING** - Tool running
- **SUCCEEDED** - Tool completed successfully
- **FAILED** - Tool encountered an error
- **CANCELLED** - User rejected the tool call

## Responding to confirmations

To approve or reject a tool call:

```typescript
// In the message/stream request body
{
  "taskId": "...",
  "contextId": "...",
  "userMessage": {
    "kind": "tool-call-confirmation",
    "toolCallId": "the-tool-call-id",
    "approved": true  // or false to reject
  }
}
```
