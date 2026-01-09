# Gemini CLI Web

A web interface for Gemini CLI that provides the same terminal-like experience
in the browser.

## Prerequisites

- Node.js 20+
- `GEMINI_API_KEY` environment variable set

## Quick Start

1. Install dependencies:

   ```bash
   cd packages/web
   npm install
   cd client
   npm install
   ```

2. Set your API key:

   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```

3. Start the development servers:

   ```bash
   # Terminal 1: Backend (from packages/web)
   npm run dev:server

   # Terminal 2: Frontend (from packages/web/client)
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Architecture

```
Browser (React + Vite)
    |
    | WebSocket + REST
    v
Node.js Backend (Express)
    |
    | Direct import
    v
@google/gemini-cli-core
    |
    v
Gemini API + Filesystem
```

## Features

- Terminal-style UI with monospace fonts and box-drawing characters
- Streaming responses with live updates
- Tool call display with status indicators
- Tool confirmation modals
- Session persistence
- Dark theme

## Development

### Server

The server is in `server/src/` and uses:

- Express for HTTP
- ws for WebSocket
- @google/gemini-cli-core for Gemini API integration

### Client

The client is in `client/src/` and uses:

- React 19
- Vite for development and building
- highlight.js for syntax highlighting
- marked for markdown rendering

## Environment Variables

- `GEMINI_API_KEY` - Your Gemini API key (required)
- `GEMINI_MODEL` - Model to use (default: gemini-pro)
- `GEMINI_YOLO_MODE` - Set to "true" to auto-approve all tools
- `WORKSPACE_PATH` - Directory for file operations (default: cwd)
- `PORT` - Server port (default: 3001)
- `DEBUG` - Enable debug logging
