/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { initializeOutputListenersAndFlush } from '../gemini.js';
import { writeToStdout, writeToStderr } from '@google/gemini-cli-core';
import { DEFAULT_BASE_DIR } from '@google/gemini-cli-diagnostics';
import open from 'open';

export const insightsCommand: CommandModule = {
  command: 'insights',
  describe: 'Launch the diagnostics viewer to analyze Gemini CLI sessions',
  builder: (yargs: Argv) =>
    yargs
      .middleware(() => {
        initializeOutputListenersAndFlush();
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        default: 3847,
        description: 'Port to run the viewer server on',
      })
      .option('session', {
        alias: 's',
        type: 'string',
        description: 'Session ID to watch (defaults to latest)',
      })
      .option('dir', {
        alias: 'd',
        type: 'string',
        default: DEFAULT_BASE_DIR,
        description: 'Base directory for diagnostics',
      })
      .option('no-open', {
        type: 'boolean',
        default: false,
        description: 'Do not automatically open the browser',
      })
      .version(false),
  handler: async (argv) => {
    try {
      const { createInsightsServer } = await import(
        '@google/gemini-cli-diagnostics-viewer'
      );

      const port = argv['port'] as number;
      const session = argv['session'] as string | undefined;
      const baseDir = argv['dir'] as string;
      const noOpen = argv['no-open'] as boolean;

      const server = createInsightsServer({
        port,
        baseDir,
        sessionId: session,
      });

      await server.start();

      const url = `http://localhost:${port}`;
      writeToStdout(`Diagnostics viewer running at ${url}\n`);

      if (!noOpen) {
        await open(url);
      }

      writeToStdout('Press Ctrl+C to stop the server\n');

      // Keep the process running
      await new Promise(() => {});
    } catch (error) {
      writeToStderr(
        `Error starting insights viewer: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }
  },
};
