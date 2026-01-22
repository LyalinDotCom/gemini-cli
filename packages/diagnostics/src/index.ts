/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type {
  DiagnosticCategory,
  ApiEventType,
  ThoughtEventType,
  ToolEventType,
  UserEventType,
  SystemEventType,
  AgentEventType,
  DiagnosticEventType,
  DiagnosticMeta,
  DiagnosticTiming,
  DiagnosticError,
  DiagnosticEvent,
  DiagnosticSpan,
  TracerConfig,
  AgentContext,
  TraceOptions,
} from './types.js';

export {
  DiagnosticsTracer,
  getDiagnostics,
  resetDiagnostics,
  enableDiagnostics,
  disableDiagnostics,
} from './tracer.js';
export type { IDiagnosticsTracer } from './tracer.js';
export {
  DiagnosticsStorage,
  DEFAULT_BASE_DIR,
  getDefaultBaseDir,
} from './storage.js';

import { getDiagnostics } from './tracer.js';
/** Lazy singleton - only created on first access */
export const diagnostics = {
  get tracer() {
    return getDiagnostics();
  },
  isEnabled: () => getDiagnostics().isEnabled(),
  enable: () => getDiagnostics().enable(),
  disable: () => getDiagnostics().disable(),
  getSessionId: () => getDiagnostics().getSessionId(),
  getSessionDir: () => getDiagnostics().getSessionDir(),
  pushAgentContext: (agentId: string, parentAgentId?: string) =>
    getDiagnostics().pushAgentContext(agentId, parentAgentId),
  popAgentContext: () => getDiagnostics().popAgentContext(),
  getCurrentAgentContext: () => getDiagnostics().getCurrentAgentContext(),
  createParallelGroup: () => getDiagnostics().createParallelGroup(),
  trace: (
    category: Parameters<ReturnType<typeof getDiagnostics>['trace']>[0],
    eventType: Parameters<ReturnType<typeof getDiagnostics>['trace']>[1],
    data: Parameters<ReturnType<typeof getDiagnostics>['trace']>[2],
    options?: Parameters<ReturnType<typeof getDiagnostics>['trace']>[3],
  ) => getDiagnostics().trace(category, eventType, data, options),
  startSpan: (
    category: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[0],
    eventType: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[1],
    initialData?: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[2],
    options?: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[3],
  ) => getDiagnostics().startSpan(category, eventType, initialData, options),
  flush: () => getDiagnostics().flush(),
};
