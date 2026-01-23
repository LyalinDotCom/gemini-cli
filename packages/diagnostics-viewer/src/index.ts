#!/usr/bin/env node
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Command } from 'commander';
import open from 'open';
import { getDefaultBaseDir } from '@google/gemini-cli-diagnostics';
import { createInsightsServer } from './server/index.js';

const program = new Command();

program
  .name('gemini-insights')
  .description('Real-time viewer for Gemini CLI diagnostics')
  .version('1.0.0')
  .option('-p, --port <number>', 'Port to run the server on', '3847')
  .option(
    '-d, --dir <path>',
    'Base directory for diagnostics',
    getDefaultBaseDir(),
  )
  .option('-s, --session <id>', 'Specific session ID to watch')
  .option('--no-open', 'Do not automatically open browser')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const shouldOpen = options.open !== false;

    // eslint-disable-next-line no-console -- CLI tool output
    console.log('Starting Gemini CLI Insights Viewer...');
    // eslint-disable-next-line no-console -- CLI tool output
    console.log(`Diagnostics directory: ${options.dir}`);

    const server = createInsightsServer({
      port,
      baseDir: options.dir,
      sessionId: options.session,
    });
    await server.start();

    if (shouldOpen) {
      // eslint-disable-next-line no-console -- CLI tool output
      console.log(`Opening browser at http://localhost:${port}`);
      await open(`http://localhost:${port}`);
    }

    process.on('SIGINT', () => {
      // eslint-disable-next-line no-console -- CLI tool output
      console.log('\nShutting down...');
      server.stop();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      server.stop();
      process.exit(0);
    });
  });

program.parse();

export { createInsightsServer } from './server/index.js';
