/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/** Event categories for diagnostic tracing */
export type DiagnosticCategory =
  | 'api'
  | 'thought'
  | 'tool'
  | 'user'
  | 'system'
  | 'memory';

/** Event types per category */
export type ApiEventType = 'request' | 'response' | 'error';
export type ThoughtEventType = 'reasoning';
export type ToolEventType = 'request' | 'complete' | 'error';
export type UserEventType = 'prompt' | 'input';
export type SystemEventType =
  | 'init'
  | 'shutdown'
  | 'config'
  | 'exception'
  | 'checkpoint';
export type MemoryEventType = 'load' | 'refresh' | 'file';

export type DiagnosticEventType =
  | ApiEventType
  | ThoughtEventType
  | ToolEventType
  | UserEventType
  | SystemEventType
  | MemoryEventType;

/** Metadata for every diagnostic event */
export interface DiagnosticMeta {
  sessionId: string;
  sequence: number;
  timestamp: string;
  category: DiagnosticCategory;
  eventType: DiagnosticEventType;
  version: number;
}

/** Timing information for spans */
export interface DiagnosticTiming {
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
}

/** Error information */
export interface DiagnosticError {
  name: string;
  message: string;
  stack?: string;
}

/** Complete diagnostic event structure */
export interface DiagnosticEvent {
  meta: DiagnosticMeta;
  timing?: DiagnosticTiming;
  data: Record<string, unknown>;
  error?: DiagnosticError;
}

/** Span interface for timed operations */
export interface DiagnosticSpan {
  end(data?: Record<string, unknown>): void;
  error(err: Error | unknown): void;
}

/** Configuration options for the tracer */
export interface TracerConfig {
  sessionId?: string;
  baseDir?: string;
  maxPayloadSize?: number;
  version?: number;
  enabled?: boolean;
}

/** Storage options */
export interface StorageOptions {
  baseDir: string;
  sessionId: string;
}

/** Write queue item */
export interface WriteQueueItem {
  filename: string;
  content: string;
}
