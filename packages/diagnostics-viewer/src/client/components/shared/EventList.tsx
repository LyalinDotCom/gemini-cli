/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface DiagnosticEvent {
  meta: {
    sessionId: string;
    sequence: number;
    timestamp: string;
    category: string;
    eventType: string;
    version: number;
  };
  timing?: { startedAt: string; endedAt?: string; durationMs?: number };
  data: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}
interface Checkpoint {
  id: string;
  name: string;
  timestamp: string;
  afterEventIndex: number;
}

interface EventListProps {
  events: DiagnosticEvent[];
  checkpoints?: Checkpoint[];
  onSelectEvent: (event: DiagnosticEvent) => void;
  selectedEvent: DiagnosticEvent | null;
  multiSelectMode?: boolean;
  selectedEvents?: DiagnosticEvent[];
  onToggleEventSelection?: (event: DiagnosticEvent) => void;
  onSelectEventsAfterCheckpoint?: (checkpoint: Checkpoint) => void;
}

const categoryColors: Record<string, string> = {
  api: '#58a6ff',
  thought: '#a371f7',
  tool: '#3fb950',
  user: '#f0883e',
  system: '#8b949e',
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return (
    d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    d.getMilliseconds().toString().padStart(3, '0')
  );
}

function getEventSummary(event: DiagnosticEvent): string {
  const { category, eventType } = event.meta;
  if (category === 'api' && event.data.model)
    return `${eventType} - ${event.data.model}`;
  if (category === 'tool' && event.data.toolName)
    return `${eventType} - ${event.data.toolName}`;
  if (category === 'thought' && event.data.subject)
    return (
      String(event.data.subject).slice(0, 50) +
      (String(event.data.subject).length > 50 ? '...' : '')
    );
  return eventType;
}

interface EventMetrics {
  value: string;
  color: string;
  growth?: { value: string; positive: boolean };
}

function getContextSize(event: DiagnosticEvent): number {
  if (event.meta.category !== 'api') return 0;

  // Calculate total context size from contents
  const contents = event.data.contents as unknown[] | undefined;
  if (!Array.isArray(contents)) return 0;

  return JSON.stringify(contents).length;
}

function getEventMetrics(
  event: DiagnosticEvent,
  prevApiEvent?: DiagnosticEvent,
): EventMetrics | null {
  const { category, eventType } = event.meta;

  // For API events - show token count or context size
  if (category === 'api') {
    const usage = event.data.usageMetadata as
      | { promptTokenCount?: number; totalTokenCount?: number }
      | undefined;

    // Calculate context size for this event
    const currentSize = getContextSize(event);
    const prevSize = prevApiEvent ? getContextSize(prevApiEvent) : 0;
    const growth = prevSize > 0 ? currentSize - prevSize : 0;

    if (usage?.totalTokenCount) {
      const result: EventMetrics = {
        value: `${(usage.totalTokenCount / 1000).toFixed(1)}k tok`,
        color: '#58a6ff',
      };
      if (growth !== 0) {
        result.growth = {
          value:
            growth > 0
              ? `+${(growth / 1000).toFixed(1)}k`
              : `${(growth / 1000).toFixed(1)}k`,
          positive: growth > 0,
        };
      }
      return result;
    }

    // For requests without usage, show context size
    if (eventType === 'request' && currentSize > 0) {
      const result: EventMetrics = {
        value: `${(currentSize / 1000).toFixed(1)}k chars`,
        color: '#3fb950',
      };
      if (growth !== 0) {
        result.growth = {
          value:
            growth > 0
              ? `+${(growth / 1000).toFixed(1)}k`
              : `${(growth / 1000).toFixed(1)}k`,
          positive: growth > 0,
        };
      }
      return result;
    }
  }

  // For tool events - show result size
  if (category === 'tool' && eventType === 'complete') {
    const result = event.data.result;
    if (result) {
      const resultStr =
        typeof result === 'string' ? result : JSON.stringify(result);
      const chars = resultStr.length;
      if (chars > 100) {
        return {
          value: chars > 1000 ? `+${(chars / 1000).toFixed(1)}k` : `+${chars}`,
          color: '#3fb950',
        };
      }
    }
  }

  return null;
}

export function EventList({
  events,
  checkpoints = [],
  onSelectEvent,
  selectedEvent,
  multiSelectMode = false,
  selectedEvents = [],
  onToggleEventSelection,
  onSelectEventsAfterCheckpoint,
}: EventListProps) {
  if (events.length === 0)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#8b949e',
          fontSize: '14px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        No events yet. Start using Gemini CLI with GEMINI_DIAGNOSTICS=1 to see
        events.
      </div>
    );

  const checkpointMap = new Map<number, Checkpoint>();
  for (const cp of checkpoints) checkpointMap.set(cp.afterEventIndex, cp);
  const isSelected = (e: DiagnosticEvent) =>
    selectedEvents.some((s) => s.meta.sequence === e.meta.sequence);

  // Build a map of previous API events for growth calculation
  const prevApiEventMap = new Map<number, DiagnosticEvent>();
  let lastApiEvent: DiagnosticEvent | undefined;
  for (const event of events) {
    if (event.meta.category === 'api') {
      if (lastApiEvent) {
        prevApiEventMap.set(event.meta.sequence, lastApiEvent);
      }
      lastApiEvent = event;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((event, index) => {
        const prevApiEvent = prevApiEventMap.get(event.meta.sequence);
        const isSel = selectedEvent?.meta.sequence === event.meta.sequence;
        const isMultiSel = multiSelectMode && isSelected(event);
        const color = categoryColors[event.meta.category] || '#8b949e';
        const checkpoint = checkpointMap.get(index);

        return (
          <React.Fragment
            key={`${event.meta.sessionId}-${event.meta.sequence}`}
          >
            <div
              onClick={() =>
                multiSelectMode && onToggleEventSelection
                  ? onToggleEventSelection(event)
                  : onSelectEvent(event)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 24px',
                cursor: 'pointer',
                background: isMultiSel
                  ? '#238636'
                  : isSel
                    ? '#21262d'
                    : 'transparent',
                borderLeft: isMultiSel ? '3px solid #3fb950' : 'none',
              }}
            >
              {multiSelectMode && (
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '1px solid #30363d',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#fff',
                    background: isMultiSel ? '#238636' : 'transparent',
                    borderColor: isMultiSel ? '#238636' : '#30363d',
                  }}
                >
                  {isMultiSel ? '✓' : ''}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: '#8b949e',
                  width: '100px',
                  flexShrink: 0,
                }}
              >
                {formatTime(event.meta.timestamp)}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  width: '70px',
                  textAlign: 'center',
                  background: color + '20',
                  color,
                }}
              >
                {event.meta.category}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#c9d1d9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '300px',
                }}
              >
                {getEventSummary(event)}
              </span>
              {(() => {
                const metrics = getEventMetrics(event, prevApiEvent);
                if (!metrics) return null;
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginLeft: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: metrics.color,
                        padding: '2px 6px',
                        background: metrics.color + '15',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {metrics.value}
                    </span>
                    {metrics.growth && (
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '10px',
                          color: metrics.growth.positive
                            ? '#f85149'
                            : '#3fb950',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {metrics.growth.value}
                      </span>
                    )}
                  </div>
                );
              })()}
              <span style={{ flex: 1 }} />
              {event.timing?.durationMs !== undefined && (
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#8b949e',
                  }}
                >
                  {event.timing.durationMs}ms
                </span>
              )}
              {event.error && (
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 600,
                    background: '#da363320',
                    color: '#da3633',
                  }}
                >
                  ERROR
                </span>
              )}
            </div>
            {checkpoint && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 24px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background:
                      'linear-gradient(90deg, transparent, #a371f7, transparent)',
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#a371f7',
                    padding: '4px 12px',
                    background: '#a371f720',
                    borderRadius: '12px',
                  }}
                >
                  {checkpoint.name}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#8b949e',
                    fontFamily: 'monospace',
                  }}
                >
                  {formatTime(checkpoint.timestamp)}
                </span>
                {onSelectEventsAfterCheckpoint && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEventsAfterCheckpoint(checkpoint);
                    }}
                    style={{
                      padding: '2px 8px',
                      border: '1px solid #a371f7',
                      borderRadius: '4px',
                      background: '#a371f720',
                      color: '#a371f7',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Select Below
                  </button>
                )}
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background:
                      'linear-gradient(90deg, transparent, #a371f7, transparent)',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
