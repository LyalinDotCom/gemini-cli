/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule, Argv } from 'yargs';
import { initializeOutputListenersAndFlush } from '../gemini.js';
import { writeToStdout, writeToStderr } from '@google/gemini-cli-core';
import { getDefaultBaseDir } from '@google/gemini-cli-diagnostics';
import open from 'open';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to import the bundled server, fall back to package import
async function loadInsightsServer(): Promise<{
  createInsightsServer: (config: {
    port: number;
    baseDir: string;
    sessionId?: string;
    clientDir?: string;
  }) => {
    start: () => Promise<{ port: number; reused: boolean }>;
    stop: () => void;
    getPort: () => number;
  };
  bundledClientDir?: string;
}> {
  // First, try to find the bundled server relative to the CLI entry point
  // In bundle mode: bundle/gemini.js -> bundle/insights/server.js
  const bundleDir = join(__dirname, '..'); // Go up from dist or wherever we are
  const bundledServerPath = join(bundleDir, 'insights', 'server.js');
  const bundledClientDir = join(bundleDir, 'insights', 'client');

  if (existsSync(bundledServerPath) && existsSync(bundledClientDir)) {
    try {
      const server = await import(bundledServerPath);
      return {
        createInsightsServer: server.createInsightsServer,
        bundledClientDir,
      };
    } catch {
      // Fall through to package import
    }
  }

  // Fall back to package import (for dev mode or if bundle not found)
  const pkg = await import('@google/gemini-cli-diagnostics-viewer');
  return { createInsightsServer: pkg.createInsightsServer };
}

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
        default: getDefaultBaseDir(),
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
      const { createInsightsServer, bundledClientDir } =
        await loadInsightsServer();

      const port = argv['port'] as number;
      const session = argv['session'] as string | undefined;
      const baseDir = argv['dir'] as string;
      const noOpen = argv['no-open'] as boolean;

      const server = createInsightsServer({
        port,
        baseDir,
        sessionId: session,
        clientDir: bundledClientDir,
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
