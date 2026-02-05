# Gemini CLI — Diagnostics Branch

This branch (`feature/diagnostics-integration`) adds a flight-recorder style
diagnostics system to Gemini CLI. It captures detailed event traces of CLI
sessions and provides a real-time web viewer for inspecting them.

## Prerequisites

- Node.js 20+

## Build

The diagnostics workspace package must be compiled before the rest of the
project can bundle. The full build handles this automatically:

```bash
npm install            # will fail on first run — that's expected
npm run build --workspace @google/gemini-cli-diagnostics   # build the diagnostics package first
npm run build          # full project build (includes all packages)
```

After the first successful build, subsequent `npm install` and `npm run build`
calls will work without the extra step.

## Running

Start the CLI in dev mode:

```bash
npm start
```

You can also enable diagnostics from the environment before starting:

```bash
GEMINI_DIAGNOSTICS=1 npm start
```

## Using the `/diagnostics` Command

Once inside the interactive CLI, the `/diagnostics` slash command (alias
`/diag`) controls tracing and the viewer.

### Start tracing

```
/diagnostics start
```

Enables event tracing for the current session. Output shows the session ID and
the directory where event files are written
(`~/.gemini/diagnostics/<session-id>/`).

### Stop tracing

```
/diagnostics stop
```

Disables tracing. Events are no longer recorded.

### Check status

```
/diagnostics status
```

Prints whether tracing is enabled, the session ID, output directory, and whether
the viewer is running.

Running `/diagnostics` with no subcommand also shows status.

### Open the viewer

```
/diagnostics viewer
```

Launches the diagnostics viewer server (default port 3847) and opens it in your
browser. You can specify a custom port:

```
/diagnostics viewer 4000
```

If a viewer is already running on that port (from this or another process), it
reuses it instead of starting a new one.

## Standalone Viewer

You can also launch the viewer outside of the interactive CLI to browse
historical sessions:

```bash
npx gemini insights
```

Options:

| Flag                  | Description                 |
| --------------------- | --------------------------- |
| `-p, --port <number>` | Server port (default: 3847) |
| `-s, --session <id>`  | Watch a specific session    |
| `-d, --dir <path>`    | Base diagnostics directory  |
| `--no-open`           | Don't auto-open the browser |

## Architecture Overview

The diagnostics system is split across three new packages and a set of
integration points in the existing CLI and core packages.

```
packages/
├── diagnostics/              # Core tracing library
├── diagnostics-viewer/       # Web-based viewer (server + client)
├── cli/                      # Integration: slash commands, CLI entry point
└── core/                     # Integration: trace calls in chat, tools, agents
```

### `@google/gemini-cli-diagnostics` — Core Library

Location: `packages/diagnostics/`

The core library that all other packages import. It provides:

- **`DiagnosticsTracer`** — Main class. Maintains a session ID, a monotonic
  sequence counter, and an agent context stack. Every call to `trace()` or
  `startSpan()` produces a `DiagnosticEvent` that is serialized to JSON and
  handed to the storage layer.
- **`DiagnosticsStorage`** — Async write queue that persists events as
  individual JSON files under `~/.gemini/diagnostics/<session-id>/`. Filenames
  are `{ISO_TIMESTAMP}_{SEQUENCE}_{CATEGORY}_{EVENT_TYPE}.json`, which makes
  them sortable by time and scannable by category.
- **`diagnostics`** — A lazily-initialized global singleton so any module can
  call `diagnostics.trace(...)` without passing a tracer instance around.
- **`enableDiagnostics()` / `disableDiagnostics()`** — Top-level helpers that
  toggle the global tracer and generate a fresh session ID on enable.

Event categories:

| Category  | Event Types                                             | What it captures          |
| --------- | ------------------------------------------------------- | ------------------------- |
| `api`     | `request`, `response`, `error`                          | Gemini API calls          |
| `thought` | `reasoning`                                             | Model reasoning steps     |
| `tool`    | `request`, `complete`, `error`                          | Tool invocations          |
| `user`    | `prompt`, `input`                                       | User interactions         |
| `system`  | `init`, `shutdown`, `config`, `exception`, `checkpoint` | Lifecycle events          |
| `memory`  | `load`, `refresh`, `file`                               | Memory/context loading    |
| `agent`   | `start`, `turn-start`, `turn-end`, `end`                | Agent execution hierarchy |

The tracer also tracks agent nesting depth, parallel execution groups, and turn
numbers so the viewer can reconstruct the full execution tree.

All diagnostics operations are wrapped in try-catch to guarantee they never
crash the host CLI process. Payloads larger than 10 MB are truncated with
metadata.

### `@google/gemini-cli-diagnostics-viewer` — Viewer

Location: `packages/diagnostics-viewer/`

A self-contained web application with two halves:

- **Server** (`src/server/`) — Express.js HTTP server + WebSocket server. Uses
  chokidar to watch the diagnostics directory for new session folders and new
  event files. When a new `.json` event file lands on disk, it reads it and
  broadcasts it to all connected WebSocket clients. Also exposes REST endpoints
  for session listing and config.
- **Client** (`src/client/`) — React SPA built with Vite. Connects to the server
  over WebSocket for real-time event streaming. Features include:
  - Live event tree view with agent hierarchy
  - Session browser for viewing past sessions
  - Event detail inspector (full JSON payload, timing, errors)
  - Live stats (event counts, durations)
  - Checkpoint creation and marking
  - Pause/resume live streaming

The server detects port conflicts and can reuse an existing viewer instance on
the same port.

### Integration Points

The diagnostics singleton is imported in several places across the existing
codebase:

- **`packages/cli/src/gemini.tsx`** — CLI entry point, initializes diagnostics
  on startup if `GEMINI_DIAGNOSTICS=1` is set.
- **`packages/cli/src/ui/commands/insightsCommand.ts`** — Registers the
  `/diagnostics` slash command and its subcommands (`start`, `stop`, `viewer`,
  `status`).
- **`packages/cli/src/commands/insights.ts`** — Registers the top-level
  `gemini insights` CLI command for standalone viewer launch.
- **`packages/core/src/core/geminiChat.ts`** — Traces API requests and
  responses.
- **`packages/core/src/core/loggingContentGenerator.ts`** — Traces model content
  generation.
- **`packages/core/src/tools/mcp-client-manager.ts`** — Traces MCP tool
  invocations.
- **`packages/core/src/utils/memoryDiscovery.ts`** — Traces memory/context file
  loading.
- **`packages/core/src/agents/local-executor.ts`** — Traces agent lifecycle
  (start, turn boundaries, end).

### Data Flow

```
User interacts with CLI
        │
        ▼
Code calls diagnostics.trace(category, eventType, data)
        │
        ▼
DiagnosticsTracer builds DiagnosticEvent (meta + timing + data)
        │
        ▼
DiagnosticsStorage enqueues write → ~/.gemini/diagnostics/<session>/<event>.json
        │
        ▼
Viewer server (chokidar) detects new file
        │
        ▼
Server reads file → broadcasts over WebSocket
        │
        ▼
React client renders event in real-time tree view
```

## Diagnostic Data Location

All session data is stored under:

```
~/.gemini/diagnostics/<session-id>/
```

Each event is a single JSON file. The format:

```json
{
  "meta": {
    "sessionId": "uuid",
    "sequence": 1,
    "timestamp": "2025-02-05T14:30:22.123Z",
    "category": "api",
    "eventType": "request",
    "version": 1,
    "agentId": "optional",
    "depth": 0,
    "turnNumber": 1
  },
  "timing": {
    "startedAt": "2025-02-05T14:30:22.123Z",
    "endedAt": "2025-02-05T14:30:23.456Z",
    "durationMs": 1333
  },
  "data": { ... },
  "error": null
}
```
