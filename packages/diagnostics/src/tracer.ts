/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type {
  DiagnosticCategory,
  DiagnosticEventType,
  DiagnosticEvent,
  DiagnosticSpan,
  DiagnosticError,
  TracerConfig,
} from './types.js';
import { DiagnosticsStorage, getDefaultBaseDir } from './storage.js';

const DEFAULT_MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;
const FORMAT_VERSION = 1;
const ENV_VAR = 'GEMINI_DIAGNOSTICS';

export class DiagnosticsTracer {
  private enabled: boolean;
  private readonly sessionId: string;
  private readonly storage: DiagnosticsStorage;
  private readonly maxPayloadSize: number;
  private readonly version: number;
  private sequence = 0;

  constructor(config: TracerConfig = {}) {
    this.enabled = config.enabled ?? process.env[ENV_VAR] === '1';
    this.sessionId = config.sessionId ?? randomUUID();
    this.maxPayloadSize = config.maxPayloadSize ?? DEFAULT_MAX_PAYLOAD_SIZE;
    this.version = config.version ?? FORMAT_VERSION;
    this.storage = new DiagnosticsStorage({
      baseDir: config.baseDir ?? getDefaultBaseDir(),
      sessionId: this.sessionId,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getSessionDir(): string {
    return this.storage.getSessionDir();
  }

  trace(
    category: DiagnosticCategory,
    eventType: DiagnosticEventType,
    data: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;
    try {
      const timestamp = new Date().toISOString();
      const sequence = ++this.sequence;
      const event: DiagnosticEvent = {
        meta: {
          sessionId: this.sessionId,
          sequence,
          timestamp,
          category,
          eventType,
          version: this.version,
        },
        data: this.truncatePayload(data),
      };
      const filename = this.storage.generateFilename(
        timestamp,
        sequence,
        category,
        eventType,
      );
      this.storage.write(filename, JSON.stringify(event, null, 2));
    } catch {
      // Zero-crash guarantee
    }
  }

  startSpan(
    category: DiagnosticCategory,
    eventType: DiagnosticEventType,
    initialData?: Record<string, unknown>,
  ): DiagnosticSpan {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    let ended = false;

    const endSpan = (
      finalData?: Record<string, unknown>,
      error?: DiagnosticError,
    ): void => {
      if (ended || !this.enabled) return;
      ended = true;
      try {
        const endedAt = new Date().toISOString();
        const durationMs = Date.now() - startTime;
        const sequence = ++this.sequence;
        const event: DiagnosticEvent = {
          meta: {
            sessionId: this.sessionId,
            sequence,
            timestamp: endedAt,
            category,
            eventType,
            version: this.version,
          },
          timing: { startedAt, endedAt, durationMs },
          data: this.truncatePayload({ ...initialData, ...finalData }),
        };
        if (error) event.error = error;
        const filename = this.storage.generateFilename(
          endedAt,
          sequence,
          category,
          eventType,
        );
        this.storage.write(filename, JSON.stringify(event, null, 2));
      } catch {
        // Zero-crash guarantee
      }
    };

    return {
      end(data?: Record<string, unknown>): void {
        endSpan(data);
      },
      error(err: Error | unknown): void {
        const diagnosticError: DiagnosticError = {
          name: err instanceof Error ? err.name : 'Error',
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        };
        endSpan(undefined, diagnosticError);
      },
    };
  }

  private truncatePayload(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const serialized = JSON.stringify(data);
      if (serialized.length <= this.maxPayloadSize) return data;
      return {
        _truncated: true,
        _originalSize: serialized.length,
        _maxSize: this.maxPayloadSize,
        _preview: serialized.slice(0, 1000),
      };
    } catch {
      return {
        _serializationError: true,
        _message: 'Failed to serialize payload',
      };
    }
  }

  async flush(): Promise<void> {
    if (!this.enabled) return;
    await this.storage.flush();
  }
}

export interface IDiagnosticsTracer {
  isEnabled(): boolean;
  enable(): void;
  disable(): void;
  getSessionId(): string;
  getSessionDir(): string;
  trace(
    category: DiagnosticCategory,
    eventType: DiagnosticEventType,
    data: Record<string, unknown>,
  ): void;
  startSpan(
    category: DiagnosticCategory,
    eventType: DiagnosticEventType,
    initialData?: Record<string, unknown>,
  ): DiagnosticSpan;
  flush(): Promise<void>;
}

let instance: DiagnosticsTracer | null = null;

export function getDiagnostics(config?: TracerConfig): IDiagnosticsTracer {
  if (!instance) {
    // Always create a real tracer now, it just starts disabled unless env var is set
    instance = new DiagnosticsTracer(config);
  }
  return instance;
}

export function enableDiagnostics(): IDiagnosticsTracer {
  if (!instance) {
    instance = new DiagnosticsTracer({ enabled: true });
  } else {
    instance.enable();
  }
  return instance;
}

export function disableDiagnostics(): void {
  if (instance) {
    instance.disable();
  }
}

export function resetDiagnostics(): void {
  instance = null;
}
