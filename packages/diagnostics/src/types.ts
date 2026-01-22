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
  | 'memory'
  | 'agent';

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
export type AgentEventType = 'start' | 'turn-start' | 'turn-end' | 'end';

export type DiagnosticEventType =
  | ApiEventType
  | ThoughtEventType
  | ToolEventType
  | UserEventType
  | SystemEventType
  | MemoryEventType
  | AgentEventType;

/** Metadata for every diagnostic event */
export interface DiagnosticMeta {
  sessionId: string;
  sequence: number;
  timestamp: string;
  category: DiagnosticCategory;
  eventType: DiagnosticEventType;
  version: number;

  // Agent hierarchy fields
  agentId?: string; // e.g., "generalist-abc123"
  parentAgentId?: string; // e.g., undefined for top-level
  depth?: number; // 0 = main agent, 1+ = subagent depth
  turnNumber?: number; // Which turn within the agent

  // Parallel execution fields
  parallelGroupId?: string; // Groups concurrent operations
  parallelIndex?: number; // Position within the parallel group
}

/** Agent context for tracking hierarchical agent execution */
export interface AgentContext {
  agentId: string;
  parentAgentId?: string;
  depth: number;
}

/** Options for trace calls with additional context */
export interface TraceOptions {
  parallelGroupId?: string;
  parallelIndex?: number;
  turnNumber?: number;
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
