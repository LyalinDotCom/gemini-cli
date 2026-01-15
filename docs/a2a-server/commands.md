# A2A Server Commands

The A2A server includes built-in commands accessible via the `/executeCommand`
endpoint. Commands provide functionality for workspace initialization, memory
management, extensions, and checkpoint restoration.

## Executing commands

To execute a command:

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{
    "command": "memory",
    "args": ["show"]
  }'
```

For streaming commands (like `init`), the response is an SSE stream.

## Listing commands

To discover available commands:

```bash
curl http://localhost:41242/listCommands
```

Returns:

```json
{
  "commands": [
    {
      "name": "memory",
      "description": "Manage agent memory/context",
      "arguments": [],
      "subCommands": [
        { "name": "memory show", "description": "Display current memory" },
        { "name": "memory add", "description": "Add to memory", "arguments": [{"name": "text"}] },
        { "name": "memory refresh", "description": "Reload memory from disk" },
        { "name": "memory list", "description": "List memory files" }
      ]
    }
  ]
}
```

## Available commands

### init

Analyzes the workspace and generates a tailored `GEMINI.md` context file.

```bash
# Execute init command (streaming)
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "init", "args": []}'
```

**Behavior:**

1. Analyzes project structure (files, directories, package.json, etc.)
2. Identifies technology stack and frameworks
3. Generates `GEMINI.md` with:
   - Project description
   - Key files and their purposes
   - Build/test commands
   - Important patterns or conventions
4. Streams progress via SSE

**Requires:** `CODER_AGENT_WORKSPACE_PATH` environment variable or workspace
setting.

### memory

Manages the agent's context from `GEMINI.md` files.

#### memory show

Displays the current memory content.

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "memory", "args": ["show"]}'
```

#### memory list

Lists all `GEMINI.md` files currently loaded.

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "memory", "args": ["list"]}'
```

#### memory add

Adds text to the memory (appends to `GEMINI.md`).

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "memory", "args": ["add", "Important: This API uses OAuth 2.0"]}'
```

#### memory refresh

Reloads memory from disk (useful after manual edits to `GEMINI.md`).

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "memory", "args": ["refresh"]}'
```

### extensions

Manages MCP extensions.

#### extensions list

Lists all installed extensions with their status.

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "extensions", "args": ["list"]}'
```

Returns information about each extension including:

- Extension name and version
- Enabled/disabled status
- Available tools
- Connection status for MCP servers

### restore

Manages Git-based checkpoints for workspace restoration.

**Requires:** Checkpointing enabled via `CHECKPOINTING=true` environment variable.

#### restore list

Lists available checkpoints.

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "restore", "args": ["list"]}'
```

#### restore \<checkpoint-name\>

Restores the workspace to a specific checkpoint.

```bash
curl -X POST http://localhost:41242/executeCommand \
  -H "Content-Type: application/json" \
  -d '{"command": "restore", "args": ["checkpoint-2024-01-15-feature-auth"]}'
```

**Behavior:**

1. Uses Git to reset workspace to checkpoint state
2. Clears conversation history
3. Reloads memory from restored files

**Warning:** This is a destructive operation that discards uncommitted changes.

## Command interface

Commands implement the following interface:

```typescript
interface Command {
  name: string;                    // Command name
  description: string;             // Human-readable description
  arguments?: CommandArgument[];   // Expected parameters
  subCommands?: Command[];         // Nested commands
  topLevel?: boolean;              // Show in /listCommands
  requiresWorkspace?: boolean;     // Requires workspace path
  streaming?: boolean;             // Returns SSE stream

  execute(
    context: CommandContext,
    args: string[]
  ): Promise<CommandExecutionResponse>;
}
```

## Response types

### Non-streaming response

```json
{
  "name": "memory",
  "data": "Contents of GEMINI.md files..."
}
```

### Streaming response

For streaming commands, the response is an SSE stream with events matching the
A2A protocol (see [Protocol](./protocol.md)).

## Error handling

Commands return errors as:

```json
{
  "error": {
    "message": "Workspace path not configured",
    "code": "WORKSPACE_REQUIRED"
  }
}
```

Common error codes:

| Code | Description |
|------|-------------|
| `WORKSPACE_REQUIRED` | Command requires workspace path |
| `COMMAND_NOT_FOUND` | Unknown command or subcommand |
| `INVALID_ARGUMENTS` | Missing or invalid arguments |
| `EXECUTION_FAILED` | Command execution error |
