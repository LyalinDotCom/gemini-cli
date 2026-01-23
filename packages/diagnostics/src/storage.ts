/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StorageOptions, WriteQueueItem } from './types.js';

let _defaultBaseDir: string | null = null;

/** Get the default base directory for diagnostics (lazy evaluation for test compatibility) */
export function getDefaultBaseDir(): string {
  if (_defaultBaseDir) return _defaultBaseDir;
  try {
    const home = homedir();
    if (home) {
      _defaultBaseDir = join(home, '.gemini', 'diagnostics');
      return _defaultBaseDir;
    }
  } catch {
    // Fallback for test environments
  }
  _defaultBaseDir = join('/tmp', '.gemini', 'diagnostics');
  return _defaultBaseDir;
}

/** Default base directory for diagnostics
 * @deprecated Use getDefaultBaseDir() instead - this constant doesn't account for home directory
 */
export const DEFAULT_BASE_DIR = getDefaultBaseDir();

/** Handles file storage for diagnostic events with async write queue */
export class DiagnosticsStorage {
  private readonly sessionDir: string;
  private readonly queue: WriteQueueItem[] = [];
  private isProcessing = false;
  private initialized = false;

  constructor(options: StorageOptions) {
    this.sessionDir = join(options.baseDir, options.sessionId);
  }

  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return;
    try {
      await mkdir(this.sessionDir, { recursive: true });
      this.initialized = true;
    } catch {
      // Silently ignore - zero-crash guarantee
    }
  }

  generateFilename(
    timestamp: string,
    sequence: number,
    category: string,
    eventType: string,
  ): string {
    const isoTimestamp = timestamp.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const paddedSequence = String(sequence).padStart(6, '0');
    return `${isoTimestamp}_${paddedSequence}_${category}_${eventType}.json`;
  }

  write(filename: string, content: string): void {
    this.queue.push({ filename, content });
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      await this.ensureDirectory();
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) continue;
        try {
          const filepath = join(this.sessionDir, item.filename);
          await writeFile(filepath, item.content, 'utf-8');
        } catch {
          // Silently ignore write errors
        }
      }
    } catch {
      // Silently ignore any errors
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        void this.processQueue();
      }
    }
  }

  async flush(): Promise<void> {
    while (this.isProcessing || this.queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  getSessionDir(): string {
    return this.sessionDir;
  }
}
