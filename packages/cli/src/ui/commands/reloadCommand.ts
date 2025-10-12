/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';

export const reloadCommand: SlashCommand = {
  name: 'reload',
  description: 'reload extensions and MCP servers without restarting the CLI',
  kind: CommandKind.BUILT_IN,
  action: async (context, _args) => {
    context.ui.setDebugMessage('Reloading extensions and MCP servers...');

    // Reload commands (extensions)
    context.ui.reloadCommands();

    // Reload MCP servers and re-discover all tools
    const config = context.services.config;
    if (config) {
      // Re-read extension configurations and discover all tools/MCP servers
      const toolRegistry = config.getToolRegistry();
      await toolRegistry.discoverAllTools();

      // Update the Gemini client with new tools
      const geminiClient = config.getGeminiClient();
      if (geminiClient) {
        await geminiClient.setTools();
      }
    }

    return {
      type: 'message',
      messageType: 'info',
      content: 'Extensions and MCP servers reloaded successfully.',
    };
  },
};
