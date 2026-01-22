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
  DiagnosticEventType,
  DiagnosticMeta,
  DiagnosticTiming,
  DiagnosticError,
  DiagnosticEvent,
  DiagnosticSpan,
  TracerConfig,
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
  trace: (
    category: Parameters<ReturnType<typeof getDiagnostics>['trace']>[0],
    eventType: Parameters<ReturnType<typeof getDiagnostics>['trace']>[1],
    data: Parameters<ReturnType<typeof getDiagnostics>['trace']>[2],
  ) => getDiagnostics().trace(category, eventType, data),
  startSpan: (
    category: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[0],
    eventType: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[1],
    initialData?: Parameters<ReturnType<typeof getDiagnostics>['startSpan']>[2],
  ) => getDiagnostics().startSpan(category, eventType, initialData),
  flush: () => getDiagnostics().flush(),
};
