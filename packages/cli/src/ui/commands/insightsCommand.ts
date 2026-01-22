/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import open from 'open';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';
import {
  diagnostics,
  enableDiagnostics,
  disableDiagnostics,
  DEFAULT_BASE_DIR,
} from '@google/gemini-cli-diagnostics';

let viewerServer: {
  start: () => Promise<{ port: number; reused: boolean }>;
  stop: () => void;
  getPort: () => number;
} | null = null;
let currentPort: number | null = null;

const DEFAULT_PORT = 3847;

const startCommand: SlashCommand = {
  name: 'start',
  description: 'Start diagnostic tracing for this session',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext): Promise<void> => {
    if (diagnostics.isEnabled()) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Diagnostics already enabled.\nSession: ${diagnostics.getSessionId()}\nOutput: ${diagnostics.getSessionDir()}`,
        },
        Date.now(),
      );
      return;
    }

    enableDiagnostics();

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Diagnostics tracing started.\nSession: ${diagnostics.getSessionId()}\nOutput: ${diagnostics.getSessionDir()}\n\nUse /debug viewer to open the insights viewer.`,
      },
      Date.now(),
    );
  },
};

const stopCommand: SlashCommand = {
  name: 'stop',
  description: 'Stop diagnostic tracing',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext): Promise<void> => {
    if (!diagnostics.isEnabled()) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: 'Diagnostics is not currently enabled.',
        },
        Date.now(),
      );
      return;
    }

    disableDiagnostics();

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: 'Diagnostics tracing stopped.',
      },
      Date.now(),
    );
  },
};

const viewerCommand: SlashCommand = {
  name: 'viewer',
  description:
    'Open the diagnostics viewer in browser (optional: specify port)',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext, args?: string): Promise<void> => {
    // Parse port from args if provided
    const requestedPort = args?.trim() ? parseInt(args.trim(), 10) : null;

    // Warn if diagnostics not enabled, but still proceed (can view historical sessions)
    if (!diagnostics.isEnabled()) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Note: Diagnostics tracing is not enabled for this session.\nUse /diagnostics start to enable tracing, or view historical sessions.`,
        },
        Date.now(),
      );
    }

    // If server already running in this process, just open the browser
    if (viewerServer && currentPort) {
      const url = `http://localhost:${currentPort}`;
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Viewer already running at ${url}`,
        },
        Date.now(),
      );
      await open(url);
      return;
    }

    const { createInsightsServer } = await import(
      '@google/gemini-cli-diagnostics-viewer'
    );

    const port = requestedPort || DEFAULT_PORT;
    const server = createInsightsServer({
      port,
      baseDir: DEFAULT_BASE_DIR,
      sessionId: diagnostics.isEnabled()
        ? diagnostics.getSessionId()
        : undefined,
    });

    try {
      const result = await server.start();

      if (result.reused) {
        // Viewer was already running from another process
        const url = `http://localhost:${result.port}`;
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: `Viewer already running at ${url}`,
          },
          Date.now(),
        );
        await open(url);
        return;
      }

      // New server started
      viewerServer = server;
      currentPort = result.port;

      if (result.port !== port) {
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: `Port ${port} in use, using ${result.port} instead.`,
          },
          Date.now(),
        );
      }

      const url = `http://localhost:${result.port}`;
      await open(url);

      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `Diagnostics viewer opened at ${url}`,
        },
        Date.now(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `Failed to start viewer: ${message}`,
        },
        Date.now(),
      );
    }
  },
};

const statusCommand: SlashCommand = {
  name: 'status',
  description: 'Show current diagnostics status',
  kind: CommandKind.BUILT_IN,
  autoExecute: true,
  action: async (context: CommandContext): Promise<void> => {
    const enabled = diagnostics.isEnabled();
    const sessionId = diagnostics.getSessionId();
    const sessionDir = diagnostics.getSessionDir();

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `Diagnostics Status:\n  Enabled: ${enabled ? 'Yes' : 'No'}\n  Session: ${sessionId || 'N/A'}\n  Output: ${sessionDir || 'N/A'}\n  Viewer: ${viewerServer && currentPort ? `Running on port ${currentPort}` : 'Not running'}`,
      },
      Date.now(),
    );
  },
};

export const diagnosticsCommand: SlashCommand = {
  name: 'diagnostics',
  altNames: ['diag'],
  description: 'Diagnostic tracing and insights viewer',
  kind: CommandKind.BUILT_IN,
  autoExecute: false,
  subCommands: [startCommand, stopCommand, viewerCommand, statusCommand],
  action: async (context: CommandContext): Promise<void> => {
    // Default action: show status
    await statusCommand.action!(context, '');
  },
};
