/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';

export const thinkbudgetCommand: SlashCommand = {
  name: 'thinkbudget',
  description: 'set or view the thinking budget for the model',
  kind: CommandKind.BUILT_IN,
  action: async (context, args) => {
    const config = context.services.config;
    
    if (!config) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Configuration not available',
        },
        Date.now(),
      );
      return;
    }

    // If no arguments, show current thinking budget
    if (!args || args.trim() === '') {
      const currentBudget = config.getThinkingBudget();
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Current thinking budget: ${currentBudget === -1 ? 'unlimited (-1)' : currentBudget + ' seconds'}`,
        },
        Date.now(),
      );
      return;
    }

    // Parse the new thinking budget value
    const newBudget = parseInt(args.trim(), 10);
    
    if (isNaN(newBudget)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Invalid thinking budget value. Please provide a number (use -1 for unlimited).',
        },
        Date.now(),
      );
      return;
    }

    if (newBudget < -1) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Thinking budget must be -1 (unlimited) or a positive number.',
        },
        Date.now(),
      );
      return;
    }

    // Set the new thinking budget
    config.setThinkingBudget(newBudget);
    
    // Reset the chat to apply the new thinking budget
    const geminiClient = config.getGeminiClient();
    if (geminiClient) {
      await geminiClient.resetChat();
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Thinking budget set to ${newBudget === -1 ? 'unlimited (-1)' : newBudget + ' seconds'}. Chat has been reset to apply the change.`,
        },
        Date.now(),
      );
    } else {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Thinking budget set to ${newBudget === -1 ? 'unlimited (-1)' : newBudget + ' seconds'}.`,
        },
        Date.now(),
      );
    }
  },
};