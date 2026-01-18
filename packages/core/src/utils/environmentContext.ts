/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Part, Content } from '@google/genai';
import type { Config } from '../config/config.js';
import { getFolderStructure } from './getFolderStructure.js';

export const INITIAL_HISTORY_LENGTH = 1;

/**
 * Generates a string describing the current workspace directories and their structures.
 * @param {Config} config - The runtime configuration and services.
 * @returns {Promise<string>} A promise that resolves to the directory context string.
 */
export async function getDirectoryContextString(
  config: Config,
): Promise<string> {
  const workspaceContext = config.getWorkspaceContext();
  const workspaceDirectories = workspaceContext.getDirectories();

  const folderStructures = await Promise.all(
    workspaceDirectories.map((dir) =>
      getFolderStructure(dir, {
        fileService: config.getFileService(),
        maxItems: 50, // Show limited structure; model should use tools to explore deeper
      }),
    ),
  );

  const folderStructure = folderStructures.join('\n');

  let workingDirPreamble: string;
  if (workspaceDirectories.length === 1) {
    workingDirPreamble = `Current working directory: ${workspaceDirectories[0]}`;
  } else {
    const dirList = workspaceDirectories.map((dir) => `  - ${dir}`).join('\n');
    workingDirPreamble = `Current working directories:\n${dirList}`;
  }

  return `${workingDirPreamble}

Top-level folder structure (use 'glob' or 'list_directory' tools to explore deeper):

${folderStructure}`;
}

/**
 * Retrieves environment-related information to be included in the chat context.
 * This includes the current working directory, date, operating system, and folder structure.
 * Optionally, it can also include the full file context if enabled.
 * @param {Config} config - The runtime configuration and services.
 * @returns A promise that resolves to an array of `Part` objects containing environment information.
 */
export async function getEnvironmentContext(config: Config): Promise<Part[]> {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const platform = process.platform;
  const directoryContext = await getDirectoryContextString(config);
  const tempDir = config.storage.getProjectTempDir();
  const environmentMemory = config.getEnvironmentMemory();

  const context = `
# Environment Context

- **Date**: ${today}
- **OS**: ${platform}
- **Temp directory**: ${tempDir}

${directoryContext}
${environmentMemory ? `\n${environmentMemory}` : ''}`.trim();

  const initialParts: Part[] = [{ text: context }];

  return initialParts;
}

export async function getInitialChatHistory(
  config: Config,
  extraHistory?: Content[],
): Promise<Content[]> {
  const envParts = await getEnvironmentContext(config);
  const envContextString = envParts.map((part) => part.text || '').join('\n\n');

  return [
    {
      role: 'user',
      parts: [{ text: envContextString }],
    },
    ...(extraHistory ?? []),
  ];
}
