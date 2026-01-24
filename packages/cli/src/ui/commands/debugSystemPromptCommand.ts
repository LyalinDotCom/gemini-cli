/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import type { MessageActionReturn } from '@google/gemini-cli-core';
import { getCoreSystemPromptForExport } from '@google/gemini-cli-core';

const exportSystemPromptCommand: SlashCommand = {
  name: 'export-system-prompt',
  description: 'Export the current system prompt for testing and customization',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context): Promise<MessageActionReturn> => {
    const config = context.services.config;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    try {
      // Get the core system prompt for export
      const systemPrompt = getCoreSystemPromptForExport(config);

      // Ensure .gemini directory exists
      const geminiDir = path.join(process.cwd(), '.gemini');
      await fsPromises.mkdir(geminiDir, { recursive: true });

      // Write to reference file
      const outputPath = path.join(geminiDir, 'system-prompt-ref.md');
      await fsPromises.writeFile(outputPath, systemPrompt, 'utf8');

      return {
        type: 'message',
        messageType: 'info',
        content: `System prompt exported to .gemini/system-prompt-ref.md

To activate override:
  mv .gemini/system-prompt-ref.md .gemini/system-prompt.md

Restart Gemini CLI to apply changes.

The file contains \${placeholders} that will be dynamically substituted:
  - \${AvailableTools} - List of available tools
  - \${SubAgents} - Available sub-agents
  - \${AgentSkills} - Available skills (if enabled)`,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        type: 'message',
        messageType: 'error',
        content: `Error exporting system prompt: ${errorMessage}`,
      };
    }
  },
};

export const debugSystemPromptCommand: SlashCommand = {
  name: 'debug',
  description: 'Debug and development tools',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [exportSystemPromptCommand],
};
