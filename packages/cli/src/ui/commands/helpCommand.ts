/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { MessageType, type HistoryItemHelp, type HelpMode } from '../types.js';

function createHelpAction(mode: HelpMode) {
  return async (
    context: Parameters<NonNullable<SlashCommand['action']>>[0],
  ) => {
    const helpItem: Omit<HistoryItemHelp, 'id'> = {
      type: MessageType.HELP,
      timestamp: new Date(),
      mode,
    };
    context.ui.addItem(helpItem);
  };
}

export const helpCommand: SlashCommand = {
  name: 'help',
  altNames: ['?'],
  kind: CommandKind.BUILT_IN,
  description: 'For help on gemini-cli',
  autoExecute: true,
  action: createHelpAction('overview'),
  subCommands: [
    {
      name: 'commands',
      kind: CommandKind.BUILT_IN,
      description: 'Show all slash commands',
      autoExecute: true,
      action: createHelpAction('commands'),
    },
    {
      name: 'shortcuts',
      kind: CommandKind.BUILT_IN,
      description: 'Show keyboard shortcuts',
      autoExecute: true,
      action: createHelpAction('shortcuts'),
    },
  ],
};
