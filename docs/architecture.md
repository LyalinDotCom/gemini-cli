# Gemini CLI Architecture Overview

This document provides a high-level overview of the Gemini CLI's architecture.

## Core components

The Gemini CLI is primarily composed of two main packages, along with a suite of
tools that can be used by the system in the course of handling command-line
input:

1.  **CLI package (`packages/cli`):**
    - **Purpose:** This contains the user-facing portion of the Gemini CLI, such
      as handling the initial user input, presenting the final output, and
      managing the overall user experience.
    - **Key functions contained in the package:**
      - [Input processing](/docs/cli/commands)
      - History management
      - Display rendering
      - [Theme and UI customization](/docs/cli/themes)
      - [CLI configuration settings](/docs/get-started/configuration)

2.  **Core package (`packages/core`):**
    - **Purpose:** This acts as the backend for the Gemini CLI. It receives
      requests sent from `packages/cli`, orchestrates interactions with the
      Gemini API, and manages the execution of available tools.
    - **Key functions contained in the package:**
      - API client for communicating with the Google Gemini API
      - Prompt construction and management
      - Tool registration and execution logic
      - State management for conversations or sessions
      - Server-side configuration

3.  **Tools (`packages/core/src/tools/`):**
    - **Purpose:** These are individual modules that extend the capabilities of
      the Gemini model, allowing it to interact with the local environment
      (e.g., file system, shell commands, web fetching).
    - **Interaction:** `packages/core` invokes these tools based on requests
      from the Gemini model.

4.  **A2A Server (`packages/a2a-server/`):**
    - **Purpose:** An HTTP-based agent server implementing the A2A
      (Agent-to-Agent) protocol. Enables integration with IDEs, web
      applications, and other clients.
    - **Key functions:**
      - HTTP endpoints for task creation and message streaming
      - Server-Sent Events (SSE) for real-time updates
      - Tool confirmation workflow
      - Task persistence (GCS or in-memory)
      - Built-in commands (init, memory, restore)

5.  **Agents (`packages/core/src/agents/`):**
    - **Purpose:** Specialized AI assistants that can be delegated tasks.
      Includes built-in agents (codebase_investigator, cli_help) and support
      for custom agents.
    - **Key functions:**
      - Agent registration and discovery
      - Local and remote agent execution
      - Agent delegation via `delegate_to_agent` tool
      - Structured output validation

## Interaction flow

A typical interaction with the Gemini CLI follows this flow:

1.  **User input:** The user types a prompt or command into the terminal, which
    is managed by `packages/cli`.
2.  **Request to core:** `packages/cli` sends the user's input to
    `packages/core`.
3.  **Request processed:** The core package:
    - Constructs an appropriate prompt for the Gemini API, possibly including
      conversation history and available tool definitions.
    - Sends the prompt to the Gemini API.
4.  **Gemini API response:** The Gemini API processes the prompt and returns a
    response. This response might be a direct answer or a request to use one of
    the available tools.
5.  **Tool execution (if applicable):**
    - When the Gemini API requests a tool, the core package prepares to execute
      it.
    - If the requested tool can modify the file system or execute shell
      commands, the user is first given details of the tool and its arguments,
      and the user must approve the execution.
    - Read-only operations, such as reading files, might not require explicit
      user confirmation to proceed.
    - Once confirmed, or if confirmation is not required, the core package
      executes the relevant action within the relevant tool, and the result is
      sent back to the Gemini API by the core package.
    - The Gemini API processes the tool result and generates a final response.
6.  **Response to CLI:** The core package sends the final response back to the
    CLI package.
7.  **Display to user:** The CLI package formats and displays the response to
    the user in the terminal.

## Key design principles

- **Modularity:** Separating the CLI (frontend) from the Core (backend) allows
  for independent development and potential future extensions (e.g., different
  frontends for the same backend).
- **Extensibility:** The tool system is designed to be extensible, allowing new
  capabilities to be added. MCP servers, extensions, hooks, skills, and custom
  agents all provide extension points.
- **User experience:** The CLI focuses on providing a rich and interactive
  terminal experience.
- **Multi-agent support:** The agent system enables task delegation to
  specialized agents for complex workflows.
- **Protocol standards:** The A2A server implements the A2A protocol for
  interoperability with other tools and platforms.
