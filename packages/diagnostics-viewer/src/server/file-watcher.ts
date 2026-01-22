/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { watch, type FSWatcher } from 'chokidar';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import type { DiagnosticEvent } from '@google/gemini-cli-diagnostics';

export class DiagnosticsFileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private readonly watchPath: string;

  constructor(watchPath: string) {
    super();
    this.watchPath = watchPath;
  }

  start(): void {
    if (this.watcher) return;
    this.watcher = watch(this.watchPath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      depth: 2,
    });

    this.watcher.on('add', (filePath) => {
      if (filePath.endsWith('.json')) void this.processFile(filePath);
    });
    this.watcher.on('change', (filePath) => {
      if (filePath.endsWith('.json')) void this.processFile(filePath);
    });
    this.watcher.on('error', (error) => this.emit('error', error));
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const event = JSON.parse(content) as DiagnosticEvent;
      this.emit('event', event, filePath);
    } catch {
      // Silently ignore parse errors
    }
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }
}
