/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { basename } from 'node:path';

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
function truncate(str: string | undefined, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}

/**
 * Extracts the root command from a shell command string.
 * E.g., "npm run build" -> "npm", "git status" -> "git"
 */
function getCommandRoot(command: string | undefined): string {
  if (!command) return 'command';
  const trimmed = command.trim();
  const firstSpace = trimmed.indexOf(' ');
  const root = firstSpace === -1 ? trimmed : trimmed.substring(0, firstSpace);
  return truncate(root, 20);
}

/**
 * Truncates a URL to show just the hostname or a short path.
 */
function truncateUrl(url: string | undefined): string {
  if (!url) return 'URL';
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return truncate(url, 30);
  }
}

/**
 * Extracts basename safely, handling undefined and empty strings.
 */
function safeBasename(filePath: string | undefined): string {
  if (!filePath) return 'file';
  return basename(filePath) || 'file';
}

/**
 * Type for the tool name mapping function.
 */
type ToolMessageGenerator = (args: Record<string, unknown>) => string;

/**
 * Maps tool names to human-readable action descriptions.
 * Each function takes the tool arguments and returns a friendly status message.
 */
export const TOOL_FRIENDLY_NAMES: Record<string, ToolMessageGenerator> = {
  // File operations
  read_file: (args) => `reading ${safeBasename(args['file_path'] as string)}`,
  read_many_files: (args) => {
    const paths = args['paths'] as string[] | undefined;
    if (paths && paths.length > 0) {
      return `reading ${paths.length} file${paths.length > 1 ? 's' : ''}`;
    }
    return 'reading files';
  },
  write_file: (args) => `writing ${safeBasename(args['file_path'] as string)}`,
  replace: (args) => `editing ${safeBasename(args['file_path'] as string)}`,
  edit: (args) => `editing ${safeBasename(args['file_path'] as string)}`,

  // Directory operations
  list_directory: (args) => {
    const dirPath = args['dir_path'] as string | undefined;
    return `listing ${dirPath ? safeBasename(dirPath) : 'directory'}`;
  },

  // Search operations
  glob: (args) => {
    const pattern = args['pattern'] as string | undefined;
    return pattern
      ? `finding files matching ${truncate(pattern, 25)}`
      : 'finding files';
  },
  search_file_content: (args) => {
    const pattern = args['pattern'] as string | undefined;
    return pattern
      ? `searching for "${truncate(pattern, 25)}"`
      : 'searching files';
  },
  grep: (args) => {
    const pattern = args['pattern'] as string | undefined;
    return pattern
      ? `searching for "${truncate(pattern, 25)}"`
      : 'searching files';
  },

  // Shell operations
  run_shell_command: (args) => {
    const command = args['command'] as string | undefined;
    return `running ${getCommandRoot(command)}`;
  },

  // Web operations
  google_web_search: (args) => {
    const query = args['query'] as string | undefined;
    return query
      ? `searching web for "${truncate(query, 25)}"`
      : 'searching web';
  },
  web_fetch: (args) => {
    const url = args['url'] as string | undefined;
    return `fetching ${truncateUrl(url)}`;
  },

  // Memory operations
  save_memory: () => 'saving to memory',

  // Task operations
  write_todos: () => 'updating tasks',
  write_todos_list: () => 'updating tasks',

  // User interaction
  ask_user: () => 'waiting for input',

  // Skills and agents
  activate_skill: (args) => {
    const skillName = args['skill_name'] as string | undefined;
    return skillName ? `activating ${skillName}` : 'activating skill';
  },
  web_researcher: () => 'researching on the web',
};

/**
 * Converts a snake_case tool name to a readable format.
 * E.g., "my_custom_tool" -> "my custom tool"
 */
function snakeCaseToReadable(name: string): string {
  return name.replace(/_/g, ' ');
}

/**
 * Strips MCP server prefix from tool names.
 * E.g., "server__tool_name" -> "tool_name"
 */
function stripMcpPrefix(name: string): string {
  const doubleUnderscoreIndex = name.indexOf('__');
  if (doubleUnderscoreIndex !== -1) {
    return name.substring(doubleUnderscoreIndex + 2);
  }
  return name;
}

/**
 * Generates a friendly status message for a tool call.
 *
 * @param toolName - The name of the tool being called
 * @param args - The arguments passed to the tool
 * @returns A human-readable status message
 */
export function getToolFriendlyMessage(
  toolName: string,
  args: Record<string, unknown> = {},
): string {
  // Check if we have a specific mapping for this tool
  const generator = TOOL_FRIENDLY_NAMES[toolName];
  if (generator) {
    return generator(args);
  }

  // For unknown tools (including MCP tools), create a generic message
  const cleanName = stripMcpPrefix(toolName);
  const readableName = snakeCaseToReadable(cleanName);
  return `using ${readableName}`;
}

/**
 * Tool call information needed for status message generation.
 */
export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  status: string;
}

/**
 * Generates a combined status message for multiple concurrent tool calls.
 *
 * @param toolCalls - Array of active tool calls
 * @returns A combined status message, or undefined if no tools are active
 */
export function getToolStatusMessage(
  toolCalls: ToolCallInfo[],
): string | undefined {
  // Filter to only executing or scheduled tools
  const activeTools = toolCalls.filter(
    (tc) =>
      tc.status === 'executing' ||
      tc.status === 'scheduled' ||
      tc.status === 'validating',
  );

  if (activeTools.length === 0) {
    return undefined;
  }

  if (activeTools.length === 1) {
    // Single tool: show its friendly name
    const tool = activeTools[0];
    return getToolFriendlyMessage(tool.name, tool.args);
  }

  if (activeTools.length <= 3) {
    // 2-3 tools: show first tool + count
    const firstTool = activeTools[0];
    const firstMessage = getToolFriendlyMessage(firstTool.name, firstTool.args);
    return `${firstMessage} (+${activeTools.length - 1} more)`;
  }

  // 4+ tools: just show count
  return `executing ${activeTools.length} tools…`;
}

/**
 * Generates a confirmation status message for a tool awaiting approval.
 *
 * @param toolCalls - Array of tool calls
 * @returns A confirmation message, or undefined if no tools awaiting approval
 */
export function getToolConfirmationMessage(
  toolCalls: ToolCallInfo[],
): string | undefined {
  const awaitingApproval = toolCalls.filter(
    (tc) => tc.status === 'awaiting_approval',
  );

  if (awaitingApproval.length === 0) {
    return undefined;
  }

  if (awaitingApproval.length === 1) {
    const tool = awaitingApproval[0];
    const friendlyMessage = getToolFriendlyMessage(tool.name, tool.args);
    return `confirm: ${friendlyMessage}`;
  }

  return `confirm: ${awaitingApproval.length} tool${awaitingApproval.length > 1 ? 's' : ''}`;
}
