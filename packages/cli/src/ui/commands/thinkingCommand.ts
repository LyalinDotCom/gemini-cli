/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';

export const thinkingCommand: SlashCommand = {
  name: 'thinking',
  description: 'show or hide model thinking process',
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

    const command = args?.trim().toLowerCase();

    // If no arguments, show current status
    if (!command) {
      const isShowing = config.getShowThoughts();
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Model thinking is currently ${isShowing ? 'shown' : 'hidden'}. Use /thinking show or /thinking hide to change.`,
        },
        Date.now(),
      );
      return;
    }

    // Handle show/hide commands
    if (command === 'show') {
      config.setShowThoughts(true);
      
      // Reset the chat to apply the new thinking configuration
      const geminiClient = config.getGeminiClient();
      if (geminiClient) {
        await geminiClient.resetChat();
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: '💭 Model thinking is now shown. Chat has been reset to apply the change.',
          },
          Date.now(),
        );
      } else {
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: '💭 Model thinking is now shown.',
          },
          Date.now(),
        );
      }
    } else if (command === 'hide') {
      config.setShowThoughts(false);
      
      // Reset the chat to apply the new thinking configuration
      const geminiClient = config.getGeminiClient();
      if (geminiClient) {
        await geminiClient.resetChat();
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: 'Model thinking is now hidden. Chat has been reset to apply the change.',
          },
          Date.now(),
        );
      } else {
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: 'Model thinking is now hidden.',
          },
          Date.now(),
        );
      }
    } else {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Invalid argument. Use /thinking show or /thinking hide',
        },
        Date.now(),
      );
    }
  },
};