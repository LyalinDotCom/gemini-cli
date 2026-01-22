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

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map((event, index) => {
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
                  flex: 1,
                  fontSize: '13px',
                  color: '#c9d1d9',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getEventSummary(event)}
              </span>
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
