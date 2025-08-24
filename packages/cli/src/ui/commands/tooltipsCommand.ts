/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommandKind, SlashCommand } from './types.js';

export const tooltipsCommand: SlashCommand = {
  name: 'tooltips',
  altNames: ['??'], // Double ?? to avoid conflict with help's ?
  kind: CommandKind.BUILT_IN,
  description: 'Toggle footer tooltips overlay',
  action: async (context) => {
    // Toggle the tooltips state
    context.ui.toggleTooltips?.();
  },
};
